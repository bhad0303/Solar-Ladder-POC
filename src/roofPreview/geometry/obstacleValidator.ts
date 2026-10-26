import type { FootprintPoint, RoofPanel, ShapeDims } from '../types'
import { rectangularSections } from './footprints'
import {
  createObstacleFromPreset,
  obstacleCorners,
  type ObstacleType,
  type RoofObstacle,
} from './obstacleTypes'
import {
  bounds,
  insetPolygon,
  panelCorners,
  pointInPolygon,
  polygonContainsPolygon,
  polygonsAabbOverlap,
} from './polygon'

export type ObstaclePlacementResult =
  | { ok: true }
  | { ok: false; reason: string }

/** Expand footprint AABB by clearance (meters) on each side. */
export function expandCorners(
  corners: FootprintPoint[],
  clearanceM: number,
): FootprintPoint[] {
  if (clearanceM <= 0) return corners
  const b = bounds(corners)
  return [
    { x: b.minX - clearanceM, z: b.minZ - clearanceM },
    { x: b.maxX + clearanceM, z: b.minZ - clearanceM },
    { x: b.maxX + clearanceM, z: b.maxZ + clearanceM },
    { x: b.minX - clearanceM, z: b.maxZ + clearanceM },
  ]
}

/** AABB overlap — reliable for axis-aligned obstacle footprints. */
export function obstaclesOverlap(
  a: RoofObstacle,
  b: RoofObstacle,
): boolean {
  return polygonsAabbOverlap(obstacleCorners(a), obstacleCorners(b))
}

export type ObstaclePanelCtx = {
  panels: RoofPanel[]
  clearanceM: number
}

/**
 * Obstacle must lie fully inside the roof inset, not overlap other obstacles,
 * and not sit under panels (incl. clearance).
 */
export function validateObstaclePlacement(
  roofPoly: FootprintPoint[],
  setbackM: number,
  candidate: RoofObstacle,
  others: RoofObstacle[],
  ignoreId?: string,
  panelCtx?: ObstaclePanelCtx,
): ObstaclePlacementResult {
  const inset = insetPolygon(roofPoly, setbackM)
  if (!inset) {
    return { ok: false, reason: 'Setback leaves no usable roof area.' }
  }
  const corners = obstacleCorners(candidate)
  // All corners + center must be inside (concave L/U edge cases)
  const cx = candidate.position.x
  const cz = candidate.position.z
  if (
    !polygonContainsPolygon(inset, corners) ||
    !pointInPolygon({ x: cx, z: cz }, inset)
  ) {
    return { ok: false, reason: 'Obstacle is outside the roof setback area.' }
  }
  for (const o of others) {
    if (ignoreId && o.id === ignoreId) continue
    if (obstaclesOverlap(candidate, o)) {
      return {
        ok: false,
        reason: 'Obstacle overlaps another obstacle — move it or pick another spot.',
      }
    }
  }
  if (panelCtx && panelCtx.panels.length > 0) {
    const clearance = panelCtx.clearanceM
    for (const p of panelCtx.panels) {
      if (
        panelOverlapsObstacle(
          {
            x: p.position.x,
            z: p.position.z,
            widthM: p.widthM,
            heightM: p.heightM,
            yawRad: (p.azimuthDeg * Math.PI) / 180,
          },
          candidate,
          clearance,
        )
      ) {
        return {
          ok: false,
          reason:
            'Obstacle overlaps a solar panel (incl. clearance) — move panels or pick another spot.',
        }
      }
    }
  }
  return { ok: true }
}

/** Panels that overlap any obstacle (for removal / messaging). */
export function filterPanelsClearOfObstacles(
  panels: RoofPanel[],
  obstacles: RoofObstacle[],
  clearanceM: number,
): { kept: RoofPanel[]; removed: number } {
  const kept: RoofPanel[] = []
  let removed = 0
  for (const p of panels) {
    const hit = panelOverlapsAnyObstacle(
      {
        x: p.position.x,
        z: p.position.z,
        widthM: p.widthM,
        heightM: p.heightM,
        yawRad: (p.azimuthDeg * Math.PI) / 180,
      },
      obstacles,
      clearanceM,
    )
    if (hit) removed++
    else kept.push({ ...p, conflict: false })
  }
  return { kept, removed }
}

/** True if panel footprint intersects obstacle footprint expanded by clearance. */
export function panelOverlapsObstacle(
  panel: {
    x: number
    z: number
    widthM: number
    heightM: number
    yawRad: number
  },
  obstacle: RoofObstacle,
  clearanceM: number,
): boolean {
  const pc = panelCorners(
    panel.x,
    panel.z,
    panel.widthM,
    panel.heightM,
    panel.yawRad,
  )
  const oc = expandCorners(obstacleCorners(obstacle), clearanceM)
  return polygonsAabbOverlap(pc, oc)
}

export function panelOverlapsAnyObstacle(
  panel: {
    x: number
    z: number
    widthM: number
    heightM: number
    yawRad: number
  },
  obstacles: RoofObstacle[],
  clearanceM: number,
): boolean {
  return obstacles.some((o) => panelOverlapsObstacle(panel, o, clearanceM))
}

export function panelsConflictingWithObstacles(
  panels: RoofPanel[],
  obstacles: RoofObstacle[],
  clearanceM: number,
): RoofPanel[] {
  return panels.map((p) => {
    const conflict = panelOverlapsAnyObstacle(
      {
        x: p.position.x,
        z: p.position.z,
        widthM: p.widthM,
        heightM: p.heightM,
        yawRad: (p.azimuthDeg * Math.PI) / 180,
      },
      obstacles,
      clearanceM,
    )
    return { ...p, conflict }
  })
}

/** Centroid of a polygon (may fall in L/U cutout — prefer section centers). */
export function footprintCentroid(poly: FootprintPoint[]): {
  x: number
  z: number
} {
  if (poly.length === 0) return { x: 0, z: 0 }
  let sx = 0
  let sz = 0
  for (const p of poly) {
    sx += p.x
    sz += p.z
  }
  return { x: sx / poly.length, z: sz / poly.length }
}

function sectionCenter(sec: FootprintPoint[]): { x: number; z: number } {
  const b = bounds(sec)
  return { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 }
}

function sectionArea(sec: FootprintPoint[]): number {
  const b = bounds(sec)
  return (b.maxX - b.minX) * (b.maxZ - b.minZ)
}

/**
 * Find a free XZ slot for a new obstacle.
 * Uses rectangular sections (L/U/T safe) — never the concave cutout centroid.
 * Returns null + reason if no valid spot (does not invent / auto-correct dims).
 */
export function findFreeObstacleSlot(
  type: ObstacleType,
  roofPoly: FootprintPoint[],
  shape: ShapeDims,
  setbackM: number,
  existing: RoofObstacle[],
  y: number,
  panelCtx?: ObstaclePanelCtx,
): { ok: true; obstacle: RoofObstacle } | { ok: false; reason: string } {
  const sections = [...rectangularSections(shape)].sort(
    (a, b) => sectionArea(b) - sectionArea(a),
  )
  const step = 0.5
  const tried: Array<{ x: number; z: number }> = []

  for (const sec of sections) {
    const b = bounds(sec)
    const mid = sectionCenter(sec)
    const candidates: Array<{ x: number; z: number }> = [{ x: mid.x, z: mid.z }]
    for (let r = step; r < Math.max(b.maxX - b.minX, b.maxZ - b.minZ); r += step) {
      for (let x = mid.x - r; x <= mid.x + r + 1e-6; x += step) {
        candidates.push({ x, z: mid.z - r }, { x, z: mid.z + r })
      }
      for (let z = mid.z - r + step; z <= mid.z + r - step + 1e-6; z += step) {
        candidates.push({ x: mid.x - r, z }, { x: mid.x + r, z })
      }
    }
    for (const c of candidates) {
      const x = Math.min(b.maxX - 0.05, Math.max(b.minX + 0.05, c.x))
      const z = Math.min(b.maxZ - 0.05, Math.max(b.minZ + 0.05, c.z))
      if (tried.some((t) => Math.hypot(t.x - x, t.z - z) < 0.2)) continue
      tried.push({ x, z })
      const candidate = createObstacleFromPreset(type, x, y, z)
      const check = validateObstaclePlacement(
        roofPoly,
        setbackM,
        candidate,
        existing,
        undefined,
        panelCtx,
      )
      if (check.ok) return { ok: true, obstacle: candidate }
    }
  }

  const midTry = createObstacleFromPreset(
    type,
    sectionCenter(sections[0]!).x,
    y,
    sectionCenter(sections[0]!).z,
  )
  const alone = validateObstaclePlacement(
    roofPoly,
    setbackM,
    midTry,
    [],
    undefined,
    panelCtx,
  )
  if (!alone.ok) {
    return {
      ok: false,
      reason: alone.reason.includes('panel')
        ? 'No free roof spot clear of panels — clear some panels or use a smaller obstacle.'
        : alone.reason === 'Obstacle is outside the roof setback area.'
          ? 'No room on roof for this obstacle — try a smaller size or lower setback.'
          : alone.reason,
    }
  }
  return {
    ok: false,
    reason:
      'No free spot — roof blocked by other obstacles or panels.',
  }
}

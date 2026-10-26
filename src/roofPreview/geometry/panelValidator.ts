import type { FootprintPoint, PanelSettings, RoofPanel, ShapeDims } from '../types'
import { rectangularSections } from './footprints'
import type { RoofObstacle } from './obstacleTypes'
import { panelOverlapsAnyObstacle } from './obstacleValidator'
import {
  insetPolygon,
  longestEdge,
  panelCorners,
  pointInPolygon,
  polygonContainsPolygon,
  polygonsAabbOverlap,
} from './polygon'

export type PanelPlacementResult =
  | { ok: true }
  | { ok: false; reason: string }

export type ObstacleContext = {
  obstacles: RoofObstacle[]
  clearanceM: number
}

/**
 * Validate that a panel footprint lies fully inside the inset roof and
 * does not overlap other panels or obstacles (AABB + clearance).
 */
export function validatePanelPlacement(
  roofPoly: FootprintPoint[],
  setbackM: number,
  candidate: {
    x: number
    z: number
    widthM: number
    heightM: number
    yawRad: number
  },
  others: RoofPanel[],
  ignoreId?: string,
  obstacleCtx?: ObstacleContext,
): PanelPlacementResult {
  const inset = insetPolygon(roofPoly, setbackM)
  if (!inset) {
    return { ok: false, reason: 'Setback leaves no usable roof area.' }
  }
  const corners = panelCorners(
    candidate.x,
    candidate.z,
    candidate.widthM,
    candidate.heightM,
    candidate.yawRad,
  )
  if (!polygonContainsPolygon(inset, corners)) {
    return { ok: false, reason: 'Panel is outside the roof setback area.' }
  }
  for (const o of others) {
    if (ignoreId && o.id === ignoreId) continue
    const oc = panelCorners(
      o.position.x,
      o.position.z,
      o.widthM,
      o.heightM,
      (o.azimuthDeg * Math.PI) / 180,
    )
    if (polygonsAabbOverlap(corners, oc)) {
      if (
        corners.some((p) => pointInPolygon(p, oc)) ||
        oc.some((p) => pointInPolygon(p, corners))
      ) {
        return { ok: false, reason: 'Panel overlaps another panel.' }
      }
    }
  }
  if (
    obstacleCtx &&
    obstacleCtx.obstacles.length > 0 &&
    panelOverlapsAnyObstacle(
      candidate,
      obstacleCtx.obstacles,
      obstacleCtx.clearanceM,
    )
  ) {
    return {
      ok: false,
      reason: 'Panel overlaps an obstacle (incl. clearance).',
    }
  }
  return { ok: true }
}

export function panelFootprintSize(settings: PanelSettings): {
  widthM: number
  depthM: number
} {
  if (settings.orientation === 'landscape') {
    return { widthM: settings.heightM, depthM: settings.widthM }
  }
  return { widthM: settings.widthM, depthM: settings.heightM }
}

/**
 * Auto-fill grid aligned to the longest roof edge; only places panels that
 * fully fit inside the inset polygon.
 */
export function autoFillPanels(
  roofPoly: FootprintPoint[],
  settings: PanelSettings,
  roofY: number,
  _azimuthDeg: number,
  obstacleCtx?: ObstacleContext,
): RoofPanel[] {
  const inset = insetPolygon(roofPoly, settings.setbackM)
  if (!inset) return []

  const edge = longestEdge(inset)
  const yaw = Math.atan2(edge.dx, edge.dz)
  const { widthM, depthM } = panelFootprintSize(settings)
  const pitchX = widthM + 0.05
  const pitchZ = depthM + settings.rowSpacingM

  const ux = edge.dx
  const uz = edge.dz
  const vx = -uz
  const vz = ux

  const xs = inset.map((p) => p.x)
  const zs = inset.map((p) => p.z)
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2

  let minU = Infinity
  let maxU = -Infinity
  let minV = Infinity
  let maxV = -Infinity
  for (const p of inset) {
    const dx = p.x - cx
    const dz = p.z - cz
    const u = dx * ux + dz * uz
    const v = dx * vx + dz * vz
    minU = Math.min(minU, u)
    maxU = Math.max(maxU, u)
    minV = Math.min(minV, v)
    maxV = Math.max(maxV, v)
  }

  const panels: RoofPanel[] = []
  let id = 0
  for (let v = minV + depthM / 2; v <= maxV - depthM / 2 + 1e-6; v += pitchZ) {
    for (let u = minU + widthM / 2; u <= maxU - widthM / 2 + 1e-6; u += pitchX) {
      const x = cx + u * ux + v * vx
      const z = cz + u * uz + v * vz
      const check = validatePanelPlacement(
        roofPoly,
        settings.setbackM,
        { x, z, widthM, heightM: depthM, yawRad: yaw },
        panels,
        undefined,
        obstacleCtx,
      )
      if (!check.ok) continue
      panels.push({
        id: `panel-${++id}`,
        position: { x, y: roofY, z },
        tiltDeg: settings.tiltDeg,
        // Store the yaw actually used for placement (edge-aligned)
        azimuthDeg: (yaw * 180) / Math.PI,
        widthM,
        heightM: depthM,
      })
    }
  }
  return panels
}

function autoFillRectSection(
  sec: FootprintPoint[],
  _fullFootprint: FootprintPoint[],
  settings: PanelSettings,
  roofY: number,
  existing: RoofPanel[],
  splitGableHalves: boolean,
  obstacleCtx?: ObstacleContext,
): RoofPanel[] {
  const inset = insetPolygon(sec, settings.setbackM)
  if (!inset) return []
  const b = {
    minX: Math.min(...inset.map((p) => p.x)),
    maxX: Math.max(...inset.map((p) => p.x)),
    minZ: Math.min(...inset.map((p) => p.z)),
    maxZ: Math.max(...inset.map((p) => p.z)),
  }
  const size = panelFootprintSize(settings)
  const alongRidge = Math.max(size.widthM, size.depthM)
  const upslope = Math.min(size.widthM, size.depthM)
  const out: RoofPanel[] = []
  const others = [...existing]

  const w = b.maxX - b.minX
  const d = b.maxZ - b.minZ
  const cx = (b.minX + b.maxX) / 2
  const cz = (b.minZ + b.maxZ) / 2
  const alongX = w >= d
  const ridgeGap = splitGableHalves ? 0.2 : 0

  const cellW = splitGableHalves && alongX ? alongRidge : size.widthM
  const cellD = splitGableHalves && alongX ? upslope : size.depthM
  const cellW2 = splitGableHalves && !alongX ? upslope : cellW
  const cellD2 = splitGableHalves && !alongX ? alongRidge : cellD
  const pitchX = (splitGableHalves && !alongX ? cellW2 : cellW) + 0.05
  const pitchZ =
    (splitGableHalves && alongX ? cellD : cellD2) + settings.rowSpacingM
  const panelW = splitGableHalves && !alongX ? cellW2 : cellW
  const panelD = splitGableHalves && alongX ? cellD : cellD2

  const bands: Array<{ minX: number; maxX: number; minZ: number; maxZ: number }> =
    splitGableHalves
      ? alongX
        ? [
            { minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: cz - ridgeGap },
            { minX: b.minX, maxX: b.maxX, minZ: cz + ridgeGap, maxZ: b.maxZ },
          ]
        : [
            { minX: b.minX, maxX: cx - ridgeGap, minZ: b.minZ, maxZ: b.maxZ },
            { minX: cx + ridgeGap, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ },
          ]
      : [b]

  for (const band of bands) {
    if (band.maxX - band.minX < panelW || band.maxZ - band.minZ < panelD) continue
    for (
      let z = band.minZ + panelD / 2;
      z <= band.maxZ - panelD / 2 + 1e-6;
      z += pitchZ
    ) {
      for (
        let x = band.minX + panelW / 2;
        x <= band.maxX - panelW / 2 + 1e-6;
        x += pitchX
      ) {
        const check = validatePanelPlacement(
          sec,
          settings.setbackM,
          { x, z, widthM: panelW, heightM: panelD, yawRad: 0 },
          others,
          undefined,
          obstacleCtx,
        )
        if (!check.ok) continue
        const p: RoofPanel = {
          id: `panel-${existing.length + out.length + 1}`,
          position: { x, y: roofY, z },
          tiltDeg: settings.tiltDeg,
          azimuthDeg: 0,
          widthM: panelW,
          heightM: panelD,
        }
        out.push(p)
        others.push(p)
      }
    }
  }
  return out
}

export function autoFillBySections(
  shape: ShapeDims,
  fullFootprint: FootprintPoint[],
  settings: PanelSettings,
  roofY: number,
  opts?: { gable?: boolean; obstacles?: RoofObstacle[] },
): RoofPanel[] {
  const sections = rectangularSections(shape)
  const all: RoofPanel[] = []
  const split = opts?.gable === true
  const obstacleCtx: ObstacleContext | undefined =
    opts?.obstacles && opts.obstacles.length > 0
      ? {
          obstacles: opts.obstacles,
          clearanceM: settings.obstacleClearanceM ?? 0.3,
        }
      : undefined
  for (const sec of sections) {
    all.push(
      ...autoFillRectSection(
        sec,
        fullFootprint,
        settings,
        roofY,
        all,
        split,
        obstacleCtx,
      ),
    )
  }
  return all.map((p, i) => ({ ...p, id: `panel-${i + 1}` }))
}

export function nextAvailablePanels(
  shape: ShapeDims,
  fullFootprint: FootprintPoint[],
  settings: PanelSettings,
  roofY: number,
  existing: RoofPanel[],
  count: number,
  opts?: { gable?: boolean; obstacles?: RoofObstacle[] },
): RoofPanel[] {
  if (count <= 0) return []
  const candidates = autoFillBySections(
    shape,
    fullFootprint,
    settings,
    roofY,
    opts,
  )
  const size = panelFootprintSize(settings)
  const clearanceM = settings.obstacleClearanceM ?? 0.3
  const obstacles = opts?.obstacles ?? []
  const added: RoofPanel[] = []
  const others = [...existing]
  for (const c of candidates) {
    if (added.length >= count) break
    const corners = panelCorners(
      c.position.x,
      c.position.z,
      c.widthM || size.widthM,
      c.heightM || size.depthM,
      (c.azimuthDeg * Math.PI) / 180,
    )
    let overlaps = false
    for (const o of others) {
      const oc = panelCorners(
        o.position.x,
        o.position.z,
        o.widthM,
        o.heightM,
        (o.azimuthDeg * Math.PI) / 180,
      )
      if (
        polygonsAabbOverlap(corners, oc) &&
        (corners.some((p) => pointInPolygon(p, oc)) ||
          oc.some((p) => pointInPolygon(p, corners)))
      ) {
        overlaps = true
        break
      }
    }
    if (overlaps) continue
    if (
      panelOverlapsAnyObstacle(
        {
          x: c.position.x,
          z: c.position.z,
          widthM: c.widthM || size.widthM,
          heightM: c.heightM || size.depthM,
          yawRad: (c.azimuthDeg * Math.PI) / 180,
        },
        obstacles,
        clearanceM,
      )
    ) {
      continue
    }
    const p: RoofPanel = {
      ...c,
      id: `panel-${Date.now()}-${existing.length + added.length + 1}`,
      widthM: c.widthM || size.widthM,
      heightM: c.heightM || size.depthM,
      conflict: false,
    }
    added.push(p)
    others.push(p)
  }
  return added
}

export function totalKw(panels: RoofPanel[], watt: number): number {
  return (panels.length * watt) / 1000
}

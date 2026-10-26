/**
 * Model-based geometric sun access (POC — not engineering-grade).
 * Samples points on each panel and ray-casts toward the sun across the day.
 */
import { getSunDirection } from '../geo/sunMath'
import type {
  NeighbourBuilding,
  Panel,
  ProjectLocation,
  RoofItem,
  TreeSpec,
} from '../data/types'

export type SerializableMesh = {
  id: string
  /** Axis-aligned box in local meters (simple occlusion for POC). */
  min: { x: number; y: number; z: number }
  max: { x: number; y: number; z: number }
}

export type SunAccessInput = {
  panels: Panel[]
  occluders: SerializableMesh[]
  location: ProjectLocation
  dayOfYear: number
  /** Minutes between samples along the day. */
  stepMinutes: number
}

export type PanelSunAccessResult = {
  panelId: string
  /** 0–1 fraction of (samplePoint × daytime samples) that see the sun. */
  accessRatio: number
}

function rayHitsAabb(
  origin: { x: number; y: number; z: number },
  dir: { x: number; y: number; z: number },
  box: SerializableMesh,
  maxDist: number,
): boolean {
  let tmin = 0
  let tmax = maxDist
  const axes = ['x', 'y', 'z'] as const
  for (const a of axes) {
    const o = origin[a]
    const d = dir[a]
    const min = box.min[a]
    const max = box.max[a]
    if (Math.abs(d) < 1e-8) {
      if (o < min || o > max) return false
      continue
    }
    let t1 = (min - o) / d
    let t2 = (max - o) / d
    if (t1 > t2) [t1, t2] = [t2, t1]
    tmin = Math.max(tmin, t1)
    tmax = Math.min(tmax, t2)
    if (tmin > tmax) return false
  }
  return tmax >= 0 && tmin <= maxDist
}

function panelSamplePoints(panel: Panel): { x: number; y: number; z: number }[] {
  const pts: { x: number; y: number; z: number }[] = []
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      pts.push({
        x: panel.position.x + (i * panel.widthM) / 3,
        y: panel.position.y + 0.05,
        z: panel.position.z + (j * panel.heightM) / 3,
      })
    }
  }
  return pts
}

export function treesToMeshes(trees: TreeSpec[]): SerializableMesh[] {
  return trees.map((t) => ({
    id: t.id,
    min: {
      x: t.position.x - t.canopyRadiusM,
      y: t.position.y,
      z: t.position.z - t.canopyRadiusM,
    },
    max: {
      x: t.position.x + t.canopyRadiusM,
      y: t.position.y + t.trunkHeightM + t.canopyHeightM,
      z: t.position.z + t.canopyRadiusM,
    },
  }))
}

export function neighboursToMeshes(
  neighbours: NeighbourBuilding[],
): SerializableMesh[] {
  return neighbours.map((n) => {
    const xs = n.polygon.map((p) => p.x)
    const zs = n.polygon.map((p) => p.z)
    return {
      id: n.id,
      min: { x: Math.min(...xs), y: 0, z: Math.min(...zs) },
      max: { x: Math.max(...xs), y: n.height, z: Math.max(...zs) },
    }
  })
}

export function roofItemsToMeshes(items: RoofItem[]): SerializableMesh[] {
  return items.map((o) => {
    const r = o.radiusM ?? (o.widthM ?? 0.5) / 2
    const h = o.heightM ?? 1
    const w = o.widthM ?? r * 2
    const d = o.depthM ?? r * 2
    return {
      id: o.id,
      min: {
        x: o.position.x - w / 2,
        y: o.position.y,
        z: o.position.z - d / 2,
      },
      max: {
        x: o.position.x + w / 2,
        y: o.position.y + h,
        z: o.position.z + d / 2,
      },
    }
  })
}

export function buildingToMesh(
  polygon: { x: number; z: number }[],
  height: number,
  id = 'building',
): SerializableMesh {
  const xs = polygon.map((p) => p.x)
  const zs = polygon.map((p) => p.z)
  return {
    id,
    min: { x: Math.min(...xs), y: 0, z: Math.min(...zs) },
    max: { x: Math.max(...xs), y: height, z: Math.max(...zs) },
  }
}

export function computeSunAccess(input: SunAccessInput): PanelSunAccessResult[] {
  const { panels, occluders, location, dayOfYear, stepMinutes } = input
  const minutes: number[] = []
  for (let m = 0; m < 1440; m += stepMinutes) minutes.push(m)

  return panels.map((panel) => {
    const samples = panelSamplePoints(panel)
    let ok = 0
    let total = 0
    for (const minuteOfDay of minutes) {
      const sun = getSunDirection(
        dayOfYear,
        minuteOfDay,
        location.lat,
        location.lon,
        location.timeZone,
      )
      if (!sun.isUp) continue
      for (const origin of samples) {
        total++
        const blocked = occluders.some((box) => {
          if (box.id === panel.id) return false
          return rayHitsAabb(origin, sun.dir, box, 200)
        })
        if (!blocked) ok++
      }
    }
    return {
      panelId: panel.id,
      accessRatio: total === 0 ? 0 : ok / total,
    }
  })
}

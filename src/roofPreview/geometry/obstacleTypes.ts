import type { FootprintPoint } from '../types'
import { panelCorners } from './polygon'

export type ObstacleType =
  | 'water_tank'
  | 'stair_room'
  | 'chimney'
  | 'ac_unit'

export type RoofObstacle = {
  id: string
  type: ObstacleType
  position: { x: number; y: number; z: number }
  /** Footprint X size (m). For water_tank this is diameter. */
  widthM: number
  /** Footprint Z size (m). For water_tank this equals widthM (diameter). */
  depthM: number
  heightM: number
  /** Boxes only; tanks use 0. */
  yawRad: number
}

/** Default size presets — labeled "default" in UI. */
export const DEFAULT_OBSTACLE_PRESETS: Record<
  ObstacleType,
  { widthM: number; depthM: number; heightM: number; label: string }
> = {
  water_tank: {
    widthM: 1.2,
    depthM: 1.2,
    heightM: 1.5,
    label: 'Water tank (default Ø1.2 × H1.5 m)',
  },
  stair_room: {
    widthM: 2.5,
    depthM: 2.0,
    heightM: 2.4,
    label: 'Stair room (default 2.5×2.0×H2.4 m)',
  },
  chimney: {
    widthM: 0.6,
    depthM: 0.6,
    heightM: 1.2,
    label: 'Chimney (default 0.6×0.6×H1.2 m)',
  },
  ac_unit: {
    widthM: 1.0,
    depthM: 0.8,
    heightM: 0.9,
    label: 'AC unit (default 1.0×0.8×H0.9 m)',
  },
}

export const OBSTACLE_TYPE_LABELS: Record<ObstacleType, string> = {
  water_tank: 'Water tank',
  stair_room: 'Stair room',
  chimney: 'Chimney',
  ac_unit: 'AC unit',
}

/** Min/max size limits (meters) — reject values outside; do not auto-correct. */
export const OBSTACLE_SIZE_LIMITS: Record<
  ObstacleType,
  { minW: number; maxW: number; minD: number; maxD: number; minH: number; maxH: number }
> = {
  water_tank: {
    minW: 0.5,
    maxW: 2.0,
    minD: 0.5,
    maxD: 2.0,
    minH: 0.6,
    maxH: 2.2,
  },
  stair_room: {
    minW: 1.0,
    maxW: 4.0,
    minD: 1.0,
    maxD: 4.0,
    minH: 1.5,
    maxH: 3.0,
  },
  chimney: {
    minW: 0.3,
    maxW: 1.2,
    minD: 0.3,
    maxD: 1.2,
    minH: 0.5,
    maxH: 2.5,
  },
  ac_unit: {
    minW: 0.4,
    maxW: 1.8,
    minD: 0.4,
    maxD: 1.5,
    minH: 0.4,
    maxH: 1.5,
  },
}

export type ObstacleSizeCheck =
  | { ok: true }
  | { ok: false; reason: string }

/** Validate obstacle dimensions against type limits (no auto-clamp). */
export function validateObstacleSize(o: RoofObstacle): ObstacleSizeCheck {
  const lim = OBSTACLE_SIZE_LIMITS[o.type]
  const w = o.widthM
  const d = o.type === 'water_tank' ? o.widthM : o.depthM
  const h = o.heightM
  if (o.type === 'water_tank') {
    if (w < lim.minW || w > lim.maxW) {
      return {
        ok: false,
        reason: `Water tank diameter must be ${lim.minW}–${lim.maxW} m (got ${w.toFixed(2)} m).`,
      }
    }
  } else {
    if (w < lim.minW || w > lim.maxW) {
      return {
        ok: false,
        reason: `${OBSTACLE_TYPE_LABELS[o.type]} width must be ${lim.minW}–${lim.maxW} m.`,
      }
    }
    if (d < lim.minD || d > lim.maxD) {
      return {
        ok: false,
        reason: `${OBSTACLE_TYPE_LABELS[o.type]} depth must be ${lim.minD}–${lim.maxD} m.`,
      }
    }
  }
  if (h < lim.minH || h > lim.maxH) {
    return {
      ok: false,
      reason: `${OBSTACLE_TYPE_LABELS[o.type]} height must be ${lim.minH}–${lim.maxH} m (got ${h.toFixed(2)} m).`,
    }
  }
  if (!Number.isFinite(w) || !Number.isFinite(d) || !Number.isFinite(h)) {
    return { ok: false, reason: 'Obstacle size must be a finite number.' }
  }
  return { ok: true }
}

/** XZ footprint corners (rectangle; tank uses diameter as width=depth). */
export function obstacleCorners(o: RoofObstacle): FootprintPoint[] {
  const w = o.type === 'water_tank' ? o.widthM : o.widthM
  const d = o.type === 'water_tank' ? o.widthM : o.depthM
  const yaw = o.type === 'water_tank' ? 0 : o.yawRad
  return panelCorners(o.position.x, o.position.z, w, d, yaw)
}

export function createObstacleFromPreset(
  type: ObstacleType,
  x: number,
  y: number,
  z: number,
  id?: string,
): RoofObstacle {
  const p = DEFAULT_OBSTACLE_PRESETS[type]
  return {
    id: id ?? `obstacle-${type}-${Date.now()}`,
    type,
    position: { x, y, z },
    widthM: p.widthM,
    depthM: p.depthM,
    heightM: p.heightM,
    yawRad: 0,
  }
}

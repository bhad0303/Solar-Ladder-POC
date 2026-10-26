import { rectangularSections } from './footprints'
import { bounds } from './polygon'
import type { ShapeDims } from '../types'

/** Default gable pitch — matches buildSlopedRoof. */
export const GABLE_PITCH_DEG = 25

export type GableMount = {
  y: number
  /** Rotation around X (radians) — N/S facing slopes (ridge along X) */
  rotX: number
  /** Rotation around Z (radians) — E/W facing slopes (ridge along Z) */
  rotZ: number
  /**
   * Root yaw. Keep 0 so panel local axes match autofill (X/Z world).
   * alongZ roofs use rotZ (same as buildSlopedRoof) — never yaw π/2.
   */
  yaw: number
}

/**
 * Height + slope orientation for a point on a gable roof.
 * Rotation matches buildSlopedRoof exactly so panels sit flush on the membrane.
 */
export function resolveGableMount(
  x: number,
  z: number,
  shape: ShapeDims,
  wallHeight: number,
): GableMount {
  const pitch = (GABLE_PITCH_DEG * Math.PI) / 180
  const sections = rectangularSections(shape)
  // Prefer the smallest matching section (avoids wrong wing on shared edges)
  let sec = sections[0]!
  let bestArea = Infinity
  for (const s of sections) {
    const b = bounds(s)
    if (
      x >= b.minX - 0.05 &&
      x <= b.maxX + 0.05 &&
      z >= b.minZ - 0.05 &&
      z <= b.maxZ + 0.05
    ) {
      const area = (b.maxX - b.minX) * (b.maxZ - b.minZ)
      if (area < bestArea) {
        bestArea = area
        sec = s
      }
    }
  }
  const b = bounds(sec)
  const w = b.maxX - b.minX
  const d = b.maxZ - b.minZ
  const cx = (b.minX + b.maxX) / 2
  const cz = (b.minZ + b.maxZ) / 2
  const alongX = w >= d
  // Near membrane mid-plane; buildPanels adds offset along roof normal
  const lift = 0.05

  if (alongX) {
    // Ridge along +X; slopes face ±Z — same rotX as gable mesh
    const half = Math.max(d / 2, 0.05)
    const dz = z - cz
    const side = dz >= 0 ? 1 : -1
    const dist = Math.min(Math.abs(dz), half)
    const y = wallHeight + Math.tan(pitch) * (half - dist) + lift
    return { y, rotX: side * pitch, rotZ: 0, yaw: 0 }
  }

  // Ridge along +Z; slopes face ±X — same rotZ as gable mesh (no yaw)
  const half = Math.max(w / 2, 0.05)
  const dx = x - cx
  const side = dx >= 0 ? 1 : -1
  const dist = Math.min(Math.abs(dx), half)
  const y = wallHeight + Math.tan(pitch) * (half - dist) + lift
  return { y, rotX: 0, rotZ: -side * pitch, yaw: 0 }
}

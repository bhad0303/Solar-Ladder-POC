import {
  MeshBuilder,
  Scene,
  ShadowGenerator,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import { GABLE_PITCH_DEG } from '../geometry/gableMount'
import { rectangularSections } from '../geometry/footprints'
import { bounds } from '../geometry/polygon'
import type { HouseConfig, ShapeDims } from '../types'
import type { RoofMaterials } from './materials'

/**
 * Gable roof from rectangular sections. Pitch = GABLE_PITCH_DEG (default 25°).
 */
export function buildSlopedRoof(
  scene: Scene,
  parent: TransformNode,
  shape: ShapeDims,
  house: HouseConfig,
  wallHeight: number,
  mats: RoofMaterials,
  shadowGen: ShadowGenerator | null,
): void {
  if (house.roofType !== 'gable') return
  const sections = rectangularSections(shape)
  const pitch = (GABLE_PITCH_DEG * Math.PI) / 180

  for (let si = 0; si < sections.length; si++) {
    const sec = sections[si]!
    const b = bounds(sec)
    const w = b.maxX - b.minX
    const d = b.maxZ - b.minZ
    const cx = (b.minX + b.maxX) / 2
    const cz = (b.minZ + b.maxZ) / 2
    const oh = house.overhangM

    // Ridge along longer axis
    const alongX = w >= d
    const span = alongX ? d : w
    const rise = Math.tan(pitch) * (span / 2 + oh)
    const half = span / 2 + oh
    const len = (alongX ? w : d) + oh * 2

    for (const side of [-1, 1] as const) {
      const slope = MeshBuilder.CreateBox(
        `gable-${si}-${side}`,
        {
          width: alongX ? len : Math.hypot(half, rise),
          height: 0.12,
          depth: alongX ? Math.hypot(half, rise) : len,
        },
        scene,
      )
      if (alongX) {
        slope.position = new Vector3(
          cx,
          wallHeight + rise / 2,
          cz + side * (half / 2),
        )
        slope.rotation.x = side * pitch
      } else {
        slope.position = new Vector3(
          cx + side * (half / 2),
          wallHeight + rise / 2,
          cz,
        )
        slope.rotation.z = -side * pitch
      }
      slope.parent = parent
      slope.material = mats.roofTile
      slope.receiveShadows = true
      shadowGen?.addShadowCaster(slope)

      // Eave fascia strip along lower edge
      const fascia = MeshBuilder.CreateBox(
        `fascia-${si}-${side}`,
        {
          width: alongX ? len : 0.12,
          height: 0.14,
          depth: alongX ? 0.12 : len,
        },
        scene,
      )
      if (alongX) {
        fascia.position = new Vector3(
          cx,
          wallHeight + 0.02,
          cz + side * half,
        )
      } else {
        fascia.position = new Vector3(
          cx + side * half,
          wallHeight + 0.02,
          cz,
        )
      }
      fascia.parent = parent
      fascia.material = mats.concrete
      fascia.receiveShadows = true
      shadowGen?.addShadowCaster(fascia)
    }

    // Ridge cap along peak
    const ridge = MeshBuilder.CreateBox(
      `ridge-${si}`,
      {
        width: alongX ? len : 0.18,
        height: 0.1,
        depth: alongX ? 0.18 : len,
      },
      scene,
    )
    ridge.position = new Vector3(cx, wallHeight + rise + 0.04, cz)
    ridge.parent = parent
    ridge.material = mats.concrete
    ridge.receiveShadows = true
    shadowGen?.addShadowCaster(ridge)
  }
}

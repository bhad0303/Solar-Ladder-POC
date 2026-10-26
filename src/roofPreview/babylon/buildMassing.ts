import {
  MeshBuilder,
  Scene,
  ShadowGenerator,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import { rectangularSections } from '../geometry/footprints'
import { bounds } from '../geometry/polygon'
import {
  activeShapeDims,
  type FootprintPoint,
  type HouseConfig,
  wallHeightM,
} from '../types'
import type { RoofMaterials } from './materials'

/** Stepped foundation height so walls sit above grade. */
export const PLINTH_TOP_M = 0.42

export type MassingHandles = {
  root: TransformNode
  wallHeight: number
  roofY: number
}

/**
 * Solid house massing from rectangular sections (CreateBox).
 * Avoids ExtrudePolygon/earcut failures that left only a wireframe border.
 */
export function buildMassing(
  scene: Scene,
  footprint: FootprintPoint[],
  house: HouseConfig,
  mats: RoofMaterials,
  shadowGen: ShadowGenerator | null,
): MassingHandles {
  const root = new TransformNode('houseRoot', scene)
  const H = wallHeightM(house)
  const sections = rectangularSections(activeShapeDims(house))
  const oh = house.overhangM
  const wallBase = PLINTH_TOP_M
  const roofY = wallBase + H + 0.08

  const fb = bounds(footprint)
  const baseCx = (fb.minX + fb.maxX) / 2
  const baseCz = (fb.minZ + fb.maxZ) / 2
  const baseW = fb.maxX - fb.minX
  const baseD = fb.maxZ - fb.minZ

  // Outer footing slab
  const footing = MeshBuilder.CreateBox(
    'footing',
    { width: baseW + 0.55, height: 0.18, depth: baseD + 0.55 },
    scene,
  )
  footing.position = new Vector3(baseCx, 0.09, baseCz)
  footing.parent = root
  footing.material = mats.concrete
  footing.receiveShadows = true
  footing.isPickable = false
  shadowGen?.addShadowCaster(footing)

  // Raised plinth / dado
  const plinth = MeshBuilder.CreateBox(
    'plinth',
    { width: baseW + 0.28, height: PLINTH_TOP_M - 0.12, depth: baseD + 0.28 },
    scene,
  )
  plinth.position = new Vector3(baseCx, 0.12 + (PLINTH_TOP_M - 0.12) / 2, baseCz)
  plinth.parent = root
  plinth.material = mats.plinth
  plinth.receiveShadows = true
  plinth.isPickable = false
  shadowGen?.addShadowCaster(plinth)

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i]!
    const b = bounds(sec)
    const w = b.maxX - b.minX
    const d = b.maxZ - b.minZ
    const cx = (b.minX + b.maxX) / 2
    const cz = (b.minZ + b.maxZ) / 2

    const body = MeshBuilder.CreateBox(
      `walls-${i}`,
      { width: w, height: H, depth: d },
      scene,
    )
    body.position = new Vector3(cx, wallBase + H / 2, cz)
    body.parent = root
    body.material = mats.wall
    body.receiveShadows = true
    body.isPickable = false
    shadowGen?.addShadowCaster(body)

    if (house.roofType === 'flat') {
      const roof = MeshBuilder.CreateBox(
        `roof-${i}`,
        { width: w + oh * 2, height: 0.18, depth: d + oh * 2 },
        scene,
      )
      roof.position = new Vector3(cx, roofY, cz)
      roof.parent = root
      roof.material = mats.roofFlat
      roof.receiveShadows = true
      roof.isPickable = false
      shadowGen?.addShadowCaster(roof)
    }
  }

  if (house.roofType === 'flat') {
    const parapetH = 0.5
    const parapetT = 0.2
    for (let i = 0; i < footprint.length; i++) {
      const a = footprint[i]!
      const bPt = footprint[(i + 1) % footprint.length]!
      const len = Math.hypot(bPt.x - a.x, bPt.z - a.z)
      if (len < 0.05) continue
      const midX = (a.x + bPt.x) / 2
      const midZ = (a.z + bPt.z) / 2
      const yaw = Math.atan2(bPt.x - a.x, bPt.z - a.z) - Math.PI / 2
      const seg = MeshBuilder.CreateBox(
        `parapet-${i}`,
        { width: len + 0.02, height: parapetH, depth: parapetT },
        scene,
      )
      seg.position = new Vector3(midX, roofY + 0.09 + parapetH / 2, midZ)
      seg.rotation.y = yaw
      seg.parent = root
      seg.material = mats.concrete
      seg.receiveShadows = true
      seg.isPickable = false
      shadowGen?.addShadowCaster(seg)
    }
  }

  return { root, wallHeight: wallBase + H, roofY }
}

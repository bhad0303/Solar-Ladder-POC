/**
 * Extrude OSM footprint polygon into a simple 3D house mass.
 * Local frame: +X east, +Y up, +Z north.
 */
import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  ShadowGenerator,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import '@babylonjs/core/Rendering/edgesRenderer'
import earcut from 'earcut'
import type { BuildingFootprint, Vec2 } from '../types/project'
import {
  createConcreteMaterial,
  createPlasterWallMaterial,
  createRoofMembraneMaterial,
} from './houseMaterials'

export function estimateBuildingHeightM(fp: BuildingFootprint): number {
  if (fp.tags.heightM != null && fp.tags.heightM > 0) return fp.tags.heightM
  if (fp.tags.levels != null && fp.tags.levels > 0) return fp.tags.levels * 3
  const kind = (fp.tags.building ?? '').toLowerCase()
  if (
    ['hospital', 'apartments', 'commercial', 'industrial', 'retail', 'school'].includes(
      kind,
    )
  ) {
    return 6.5
  }
  return 3.2
}

function ringBounds(poly: Vec2[]) {
  const xs = poly.map((p) => p.x)
  const zs = poly.map((p) => p.z)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    width: maxX - minX,
    depth: maxZ - minZ,
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
  }
}

/** Ensure CCW winding for ExtrudePolygon + earcut. */
function ensureCcw(poly: Vec2[]): Vec2[] {
  let sum = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % poly.length]!
    sum += a.x * b.z - b.x * a.z
  }
  return sum < 0 ? [...poly].reverse() : poly
}

export type FootprintHouseHandles = {
  root: TransformNode
  heightM: number
  center: Vector3
  extent: number
}

export function buildFootprintHouse(
  scene: Scene,
  shadowGen: ShadowGenerator,
  footprint: BuildingFootprint,
): FootprintHouseHandles {
  const raw = footprint.polygonLocal
  if (raw.length < 3) {
    throw new Error('Footprint polygon needs at least 3 points')
  }
  const poly = ensureCcw(raw)
  const H = estimateBuildingHeightM(footprint)
  const { width, depth, cx, cz } = ringBounds(poly)
  const extent = Math.max(width, depth, 8)

  const root = new TransformNode('footprintHouse', scene)

  const wallMat = createPlasterWallMaterial(scene, 'fpWall', '#d6d1c8')
  const roofMat = createRoofMembraneMaterial(scene, 'fpRoof')
  const plinthMat = createConcreteMaterial(scene, 'fpPlinth', '#8e8880')
  const parapetMat = createPlasterWallMaterial(scene, 'fpParapet', '#c4bcb4')
  const trimMat = createConcreteMaterial(scene, 'fpTrim', '#c8c4bc')

  const shape = poly.map((p) => new Vector3(p.x, 0, p.z))
  const body = MeshBuilder.ExtrudePolygon(
    'houseBody',
    { shape, depth: H, sideOrientation: Mesh.DOUBLESIDE },
    scene,
    earcut,
  )
  // ExtrudePolygon builds downward; lift so base sits on y=0
  body.position.y = H
  body.parent = root
  body.receiveShadows = true
  body.material = wallMat
  body.enableEdgesRendering(0.95)
  body.edgesWidth = 1.2
  body.edgesColor = Color3.FromHexString('#6a655e').toColor4(0.7)
  shadowGen.addShadowCaster(body)

  const plinth = MeshBuilder.CreateBox(
    'plinth',
    { width: width + 0.35, height: 0.28, depth: depth + 0.35 },
    scene,
  )
  plinth.position = new Vector3(cx, 0.14, cz)
  plinth.parent = root
  plinth.receiveShadows = true
  plinth.material = plinthMat
  shadowGen.addShadowCaster(plinth)

  const roof = MeshBuilder.CreateBox(
    'roofSlab',
    { width: width + 0.25, height: 0.14, depth: depth + 0.25 },
    scene,
  )
  roof.position = new Vector3(cx, H + 0.07, cz)
  roof.parent = root
  roof.receiveShadows = true
  roof.material = roofMat
  roof.enableEdgesRendering(0.95)
  roof.edgesWidth = 1
  roof.edgesColor = Color3.FromHexString('#9a948c').toColor4(0.5)
  shadowGen.addShadowCaster(roof)

  const parapetH = 0.45
  const parapetT = 0.18
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % poly.length]!
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    if (len < 0.05) continue
    const mid = new Vector3(
      (a.x + b.x) / 2,
      H + 0.14 + parapetH / 2,
      (a.z + b.z) / 2,
    )
    const yaw = Math.atan2(b.x - a.x, b.z - a.z)
    const seg = MeshBuilder.CreateBox(
      `parapet-${i}`,
      { width: len, height: parapetH, depth: parapetT },
      scene,
    )
    seg.position = mid
    seg.rotation.y = yaw
    seg.parent = root
    seg.material = parapetMat
    seg.receiveShadows = true
    shadowGen.addShadowCaster(seg)

    const coping = MeshBuilder.CreateBox(
      `coping-${i}`,
      { width: len + 0.04, height: 0.05, depth: parapetT + 0.06 },
      scene,
    )
    coping.position = new Vector3(mid.x, H + 0.14 + parapetH + 0.025, mid.z)
    coping.rotation.y = yaw
    coping.parent = root
    coping.material = trimMat
    shadowGen.addShadowCaster(coping)
  }

  // Satellite ground is added separately under the house (see solarRoofScene).

  return {
    root,
    heightM: H,
    center: new Vector3(cx, H * 0.45, cz),
    extent,
  }
}

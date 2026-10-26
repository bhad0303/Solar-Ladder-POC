import {
  MeshBuilder,
  Scene,
  ShadowGenerator,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import { bounds } from '../geometry/polygon'
import type { FootprintPoint, HouseConfig } from '../types'
import { PLINTH_TOP_M } from './buildMassing'
import type { RoofMaterials } from './materials'

/** Door, windows, optional trees. Obstacles are user-placed via buildObstacles. */
export function buildDetails(
  scene: Scene,
  parent: TransformNode,
  footprint: FootprintPoint[],
  house: HouseConfig,
  _wallHeight: number,
  mats: RoofMaterials,
  shadowGen: ShadowGenerator | null,
  opts?: { includeTrees?: boolean },
): void {
  const includeTrees = opts?.includeTrees !== false
  const b = bounds(footprint)
  const cx = (b.minX + b.maxX) / 2
  const cz = (b.minZ + b.maxZ) / 2

  // Sit slightly proud of solid wall faces so they read as openings
  const door = MeshBuilder.CreateBox(
    'door',
    { width: 1.0, height: 2.1, depth: 0.12 },
    scene,
  )
  door.position = new Vector3(cx, PLINTH_TOP_M + 1.05, b.minZ - 0.05)
  door.parent = parent
  door.material = mats.door
  door.receiveShadows = true
  shadowGen?.addShadowCaster(door)

  for (let floor = 0; floor < house.floors; floor++) {
    const yBase =
      PLINTH_TOP_M + floor * house.floorHeightM + house.floorHeightM * 0.45
    const winH = 1.1
    const winW = 1.2
    for (const ox of [-Math.abs(cx) * 0.35 || -2, Math.abs(cx) * 0.35 || 2]) {
      if (floor === 0 && Math.abs(ox) < 0.8) continue
      addWindow(
        scene,
        parent,
        mats,
        shadowGen,
        `win-S-${floor}-${ox}`,
        cx + ox,
        yBase,
        b.minZ - 0.05,
        winW,
        winH,
        0.1,
      )
    }
    addWindow(
      scene,
      parent,
      mats,
      shadowGen,
      `win-E-${floor}`,
      b.maxX + 0.05,
      yBase,
      cz,
      0.1,
      winH,
      winW,
    )
    addWindow(
      scene,
      parent,
      mats,
      shadowGen,
      `win-W-${floor}`,
      b.minX - 0.05,
      yBase,
      cz,
      0.1,
      winH,
      winW,
    )
  }

  // Roof obstacles (tanks, stair, chimney, AC) are user-placed via buildObstacles.

  // Skip procedural trees when aerial photo already shows vegetation
  if (includeTrees) {
    placeTree(scene, parent, mats, shadowGen, b.minX - 3.2, b.minZ - 2.2, 1)
    placeTree(scene, parent, mats, shadowGen, b.maxX + 3.8, b.minZ + 1.2, 1.15)
    placeTree(scene, parent, mats, shadowGen, b.minX - 2.4, b.maxZ + 3.5, 0.9)
  }
}

function addWindow(
  scene: Scene,
  parent: TransformNode,
  mats: RoofMaterials,
  shadowGen: ShadowGenerator | null,
  name: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
): void {
  const frame = MeshBuilder.CreateBox(
    `${name}-frame`,
    { width: w + 0.1, height: h + 0.1, depth: d + 0.02 },
    scene,
  )
  frame.position = new Vector3(x, y, z)
  frame.parent = parent
  frame.material = mats.plinth
  frame.receiveShadows = true
  shadowGen?.addShadowCaster(frame)

  const glass = MeshBuilder.CreateBox(
    `${name}-glass`,
    { width: w, height: h, depth: d },
    scene,
  )
  glass.position = new Vector3(x, y, z)
  glass.parent = parent
  glass.material = mats.glass
}

function placeTree(
  scene: Scene,
  parent: TransformNode,
  mats: RoofMaterials,
  shadowGen: ShadowGenerator | null,
  x: number,
  z: number,
  scale: number,
): void {
  const trunkH = 2.1 * scale
  const trunk = MeshBuilder.CreateCylinder(
    `trunk-${x}-${z}`,
    { height: trunkH, diameter: 0.32 * scale, tessellation: 8 },
    scene,
  )
  trunk.position = new Vector3(x, trunkH / 2, z)
  trunk.parent = parent
  trunk.material = mats.bark
  trunk.receiveShadows = true
  shadowGen?.addShadowCaster(trunk)

  const leafMats = [mats.leaf, mats.leafAlt, mats.leafAlt2]
  const clusters: Array<{
    y: number
    ox: number
    oz: number
    d: number
    kind: 'sphere' | 'cone'
  }> = [
    { y: 2.6 * scale, ox: 0, oz: 0, d: 2.2 * scale, kind: 'sphere' },
    { y: 3.1 * scale, ox: 0.45 * scale, oz: -0.25 * scale, d: 1.6 * scale, kind: 'sphere' },
    { y: 2.9 * scale, ox: -0.4 * scale, oz: 0.35 * scale, d: 1.5 * scale, kind: 'cone' },
  ]

  clusters.forEach((c, i) => {
    const mat = leafMats[i % leafMats.length]!
    if (c.kind === 'sphere') {
      const leaf = MeshBuilder.CreateSphere(
        `leaf-${x}-${z}-${i}`,
        { diameter: c.d, segments: 10 },
        scene,
      )
      leaf.position = new Vector3(x + c.ox, c.y, z + c.oz)
      leaf.parent = parent
      leaf.material = mat
      leaf.receiveShadows = true
      shadowGen?.addShadowCaster(leaf)
    } else {
      const leaf = MeshBuilder.CreateCylinder(
        `leafCone-${x}-${z}-${i}`,
        {
          height: c.d * 0.95,
          diameterTop: 0.15 * scale,
          diameterBottom: c.d,
          tessellation: 8,
        },
        scene,
      )
      leaf.position = new Vector3(x + c.ox, c.y, z + c.oz)
      leaf.parent = parent
      leaf.material = mat
      leaf.receiveShadows = true
      shadowGen?.addShadowCaster(leaf)
    }
  })
}

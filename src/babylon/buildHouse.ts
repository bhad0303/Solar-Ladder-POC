/**
 * Procedural residential house assembly (Babylon skill: TransformNode hierarchy,
 * textured StandardMaterials, edges for silhouette).
 */
import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import '@babylonjs/core/Rendering/edgesRenderer'
import earcut from 'earcut'
import type { Building, RoofItem } from '../data/types'
import {
  createConcreteMaterial,
  createFrameMaterial,
  createGlassMaterial,
  createPlasterWallMaterial,
  createRoofMembraneMaterial,
} from './houseMaterials'

export function buildHouse(
  scene: Scene,
  parent: TransformNode,
  shadowGen: ShadowGenerator,
  building: Building,
  roofItems: RoofItem[],
): void {
  const H = building.height
  const poly = building.polygon
  const xs = poly.map((p) => p.x)
  const zs = poly.map((p) => p.z)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  const width = maxX - minX
  const depth = maxZ - minZ
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2

  const houseRoot = new TransformNode('houseRoot', scene)
  houseRoot.parent = parent

  const wallMat = createPlasterWallMaterial(
    scene,
    'wallPlaster',
    building.wallColors?.N ?? '#d6d1c8',
  )
  const roofMat = createRoofMembraneMaterial(scene, 'roofMembrane')
  const plinthMat = createConcreteMaterial(scene, 'plinthConcrete', '#8e8880')
  const parapetMat = createPlasterWallMaterial(scene, 'parapetPlaster', '#c4bcb4')
  const glassMat = createGlassMaterial(scene, 'windowGlass')
  const frameMat = createFrameMaterial(scene, 'windowFrame', '#f0f2f5')
  const doorMat = createFrameMaterial(scene, 'doorMat', '#4a5568')
  const trimMat = createConcreteMaterial(scene, 'corniceMat', '#c8c4bc')

  // Main mass
  const shape = poly.map((p) => new Vector3(p.x, 0, p.z))
  const body = MeshBuilder.ExtrudePolygon(
    'houseBody',
    { shape, depth: H, sideOrientation: Mesh.DOUBLESIDE },
    scene,
    earcut,
  )
  body.position.y = H
  body.parent = houseRoot
  body.receiveShadows = true
  body.material = wallMat
  body.enableEdgesRendering(0.95)
  body.edgesWidth = 1.2
  body.edgesColor = Color3.FromHexString('#6a655e').toColor4(0.7)
  shadowGen.addShadowCaster(body)

  // Plinth
  const plinth = MeshBuilder.CreateBox(
    'plinth',
    { width: width + 0.3, height: 0.32, depth: depth + 0.3 },
    scene,
  )
  plinth.position = new Vector3(cx, 0.16, cz)
  plinth.parent = houseRoot
  plinth.receiveShadows = true
  plinth.material = plinthMat
  shadowGen.addShadowCaster(plinth)

  // Roof slab + membrane texture
  const roof = MeshBuilder.CreateBox(
    'roofSlab',
    { width: width + 0.2, height: 0.14, depth: depth + 0.2 },
    scene,
  )
  roof.position = new Vector3(cx, H + 0.07, cz)
  roof.parent = houseRoot
  roof.receiveShadows = true
  roof.material = roofMat
  roof.enableEdgesRendering(0.95)
  roof.edgesWidth = 1.0
  roof.edgesColor = Color3.FromHexString('#9a948c').toColor4(0.5)
  shadowGen.addShadowCaster(roof)

  // Cornice ledge under roof edge
  const cornice = MeshBuilder.CreateBox(
    'cornice',
    { width: width + 0.35, height: 0.12, depth: depth + 0.35 },
    scene,
  )
  cornice.position = new Vector3(cx, H - 0.02, cz)
  cornice.parent = houseRoot
  cornice.material = trimMat
  cornice.receiveShadows = true
  shadowGen.addShadowCaster(cornice)

  // Parapet with coping caps
  const parapetH = 0.5
  const parapetT = 0.2
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % poly.length]!
    const len = Math.hypot(b.x - a.x, b.z - a.z)
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
    seg.parent = houseRoot
    seg.material = parapetMat
    seg.receiveShadows = true
    shadowGen.addShadowCaster(seg)

    const coping = MeshBuilder.CreateBox(
      `coping-${i}`,
      { width: len + 0.05, height: 0.06, depth: parapetT + 0.08 },
      scene,
    )
    coping.position = new Vector3(mid.x, H + 0.14 + parapetH + 0.03, mid.z)
    coping.rotation.y = yaw
    coping.parent = houseRoot
    coping.material = trimMat
    shadowGen.addShadowCaster(coping)
  }

  // Per-side soft tint skins
  addSkin(scene, houseRoot, shadowGen, wallMat, 'skinN', cx, H * 0.52, minZ - 0.015, width * 0.96, H * 0.88, 0.03)
  addSkin(scene, houseRoot, shadowGen, wallMat, 'skinS', cx, H * 0.52, maxZ + 0.015, width * 0.96, H * 0.88, 0.03)
  addSkin(scene, houseRoot, shadowGen, wallMat, 'skinE', maxX + 0.015, H * 0.52, cz, 0.03, H * 0.88, depth * 0.96)
  addSkin(scene, houseRoot, shadowGen, wallMat, 'skinW', minX - 0.015, H * 0.52, cz, 0.03, H * 0.88, depth * 0.96)

  // Windows with frames (east / west / south)
  addFramedWindow(scene, houseRoot, shadowGen, glassMat, frameMat, maxX + 0.04, 1.45, cz - 2.2, 0.06, 1.15, 1.35)
  addFramedWindow(scene, houseRoot, shadowGen, glassMat, frameMat, maxX + 0.04, 1.45, cz + 0.2, 0.06, 1.15, 1.35)
  addFramedWindow(scene, houseRoot, shadowGen, glassMat, frameMat, maxX + 0.04, 1.45, cz + 2.4, 0.06, 1.15, 1.2)
  addFramedWindow(scene, houseRoot, shadowGen, glassMat, frameMat, minX - 0.04, 1.45, cz - 1.5, 0.06, 1.15, 1.5)
  addFramedWindow(scene, houseRoot, shadowGen, glassMat, frameMat, minX - 0.04, 1.45, cz + 1.8, 0.06, 1.15, 1.4)
  addFramedWindow(scene, houseRoot, shadowGen, glassMat, frameMat, cx - 3, 1.5, maxZ + 0.04, 1.4, 1.2, 0.06)
  addFramedWindow(scene, houseRoot, shadowGen, glassMat, frameMat, cx + 3, 1.5, maxZ + 0.04, 1.4, 1.2, 0.06)

  // Front door (south face)
  const door = MeshBuilder.CreateBox(
    'frontDoor',
    { width: 1.05, height: 2.15, depth: 0.08 },
    scene,
  )
  door.position = new Vector3(cx - 0.2, 1.07, maxZ + 0.05)
  door.parent = houseRoot
  door.material = doorMat
  shadowGen.addShadowCaster(door)
  const doorFrame = MeshBuilder.CreateBox(
    'doorFrame',
    { width: 1.2, height: 2.3, depth: 0.06 },
    scene,
  )
  doorFrame.position = new Vector3(cx - 0.2, 1.15, maxZ + 0.02)
  doorFrame.parent = houseRoot
  doorFrame.material = frameMat
  shadowGen.addShadowCaster(doorFrame)

  // Roof items
  for (const item of roofItems) {
    buildRoofItem(scene, houseRoot, shadowGen, item, frameMat)
  }
}

function addSkin(
  scene: Scene,
  parent: TransformNode,
  shadowGen: ShadowGenerator,
  mat: StandardMaterial,
  name: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
): void {
  const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene)
  m.position = new Vector3(x, y, z)
  m.parent = parent
  m.material = mat
  m.receiveShadows = true
  shadowGen.addShadowCaster(m)
}

function addFramedWindow(
  scene: Scene,
  parent: TransformNode,
  shadowGen: ShadowGenerator,
  glassMat: StandardMaterial,
  frameMat: StandardMaterial,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
): void {
  const frame = MeshBuilder.CreateBox(
    `winFrame-${x}-${z}`,
    { width: w + 0.1, height: h + 0.1, depth: d + 0.02 },
    scene,
  )
  frame.position = new Vector3(x, y, z)
  frame.parent = parent
  frame.material = frameMat
  shadowGen.addShadowCaster(frame)

  const glass = MeshBuilder.CreateBox(
    `winGlass-${x}-${z}`,
    { width: w, height: h, depth: d },
    scene,
  )
  // Push glass slightly out so frame reads
  const out = d > w ? 0.02 : 0.02
  glass.position = new Vector3(
    x + (d < 0.2 && w < 0.2 ? Math.sign(x) * out : 0),
    y,
    z + (d < 0.2 && w >= 0.2 ? Math.sign(z || 1) * out : d >= 0.2 ? Math.sign(z) * 0.02 : 0),
  )
  // Simpler: same center, slightly thinner glass sits inside frame visually via depth
  glass.position = new Vector3(x, y, z)
  glass.scaling = new Vector3(0.92, 0.9, 1.05)
  glass.parent = parent
  glass.material = glassMat
  glass.visibility = 0.95
  shadowGen.addShadowCaster(glass)

  // Mullion
  const mullion = MeshBuilder.CreateBox(
    `mullion-${x}-${z}`,
    {
      width: w > d ? 0.04 : w * 0.9,
      height: h * 0.9,
      depth: w > d ? d * 1.1 : 0.04,
    },
    scene,
  )
  mullion.position = new Vector3(x, y, z)
  mullion.parent = parent
  mullion.material = frameMat
}

function buildRoofItem(
  scene: Scene,
  parent: TransformNode,
  shadowGen: ShadowGenerator,
  item: RoofItem,
  metalMat: StandardMaterial,
): void {
  if (item.kind === 'tank') {
    const bottomD = (item.radiusM ?? 0.55) * 2
    const topD = bottomD * 0.35
    const bodyH = (item.heightM ?? 1.35) * 0.78
    const coneH = (item.heightM ?? 1.35) * 0.15
    const capH = 0.05
    const baseY = item.position.y
    const tankMat = new StandardMaterial(`tankMat-${item.id}`, scene)
    tankMat.diffuseColor = Color3.FromHexString('#2a2a2c')
    tankMat.specularColor = new Color3(0.45, 0.45, 0.48)
    tankMat.specularPower = 64
    tankMat.emissiveColor = Color3.FromHexString('#141416')

    const body = MeshBuilder.CreateCylinder(
      `tank-body-${item.id}`,
      { height: bodyH, diameter: bottomD, tessellation: 28 },
      scene,
    )
    body.position = new Vector3(item.position.x, baseY + bodyH / 2, item.position.z)
    body.parent = parent
    body.material = tankMat
    body.receiveShadows = true
    shadowGen.addShadowCaster(body)

    const cone = MeshBuilder.CreateCylinder(
      `tank-cone-${item.id}`,
      {
        height: coneH,
        diameterTop: topD,
        diameterBottom: bottomD * 0.95,
        tessellation: 28,
      },
      scene,
    )
    cone.position = new Vector3(
      item.position.x,
      baseY + bodyH + coneH / 2,
      item.position.z,
    )
    cone.parent = parent
    cone.material = tankMat
    shadowGen.addShadowCaster(cone)

    const cap = MeshBuilder.CreateCylinder(
      `tank-cap-${item.id}`,
      { height: capH, diameter: topD * 1.15, tessellation: 16 },
      scene,
    )
    cap.position = new Vector3(
      item.position.x,
      baseY + bodyH + coneH + capH / 2,
      item.position.z,
    )
    cap.parent = parent
    cap.material = metalMat
    shadowGen.addShadowCaster(cap)

    // Stand ring
    const stand = MeshBuilder.CreateCylinder(
      `tank-stand-${item.id}`,
      { height: 0.12, diameter: bottomD * 1.08, tessellation: 20 },
      scene,
    )
    stand.position = new Vector3(item.position.x, baseY + 0.06, item.position.z)
    stand.parent = parent
    stand.material = metalMat
    shadowGen.addShadowCaster(stand)
    return
  }

  if (item.kind === 'mumty') {
    const w = item.widthM ?? 2.4
    const d = item.depthM ?? 2.2
    const h = item.heightM ?? 2.1
    const plaster = createPlasterWallMaterial(scene, `mumtyPlaster-${item.id}`, '#ddd8d0')
    const box = MeshBuilder.CreateBox(
      `mumty-${item.id}`,
      { width: w, height: h, depth: d },
      scene,
    )
    box.position = new Vector3(
      item.position.x,
      item.position.y + h / 2,
      item.position.z,
    )
    box.parent = parent
    box.material = plaster
    box.receiveShadows = true
    box.enableEdgesRendering(0.95)
    box.edgesWidth = 1.0
    box.edgesColor = Color3.FromHexString('#7a756e').toColor4(0.6)
    shadowGen.addShadowCaster(box)

    const door = MeshBuilder.CreateBox(
      `mumty-door-${item.id}`,
      { width: 0.75, height: 1.55, depth: 0.07 },
      scene,
    )
    door.position = new Vector3(
      item.position.x,
      item.position.y + 0.78,
      item.position.z + d / 2 + 0.04,
    )
    door.parent = parent
    const doorMat = new StandardMaterial(`mumtyDoorMat-${item.id}`, scene)
    doorMat.diffuseColor = new Color3(0.32, 0.38, 0.48)
    door.material = doorMat
    shadowGen.addShadowCaster(door)

    const top = MeshBuilder.CreateBox(
      `mumty-roof-${item.id}`,
      { width: w + 0.12, height: 0.1, depth: d + 0.12 },
      scene,
    )
    top.position = new Vector3(
      item.position.x,
      item.position.y + h + 0.05,
      item.position.z,
    )
    top.parent = parent
    top.material = createRoofMembraneMaterial(scene, `mumtyRoof-${item.id}`)
    shadowGen.addShadowCaster(top)
    return
  }

  if (item.kind === 'vent') {
    const h = item.heightM ?? 0.55
    const r = item.radiusM ?? 0.08
    const pipe = MeshBuilder.CreateCylinder(
      `vent-${item.id}`,
      { height: h, diameter: r * 2, tessellation: 14 },
      scene,
    )
    pipe.position = new Vector3(
      item.position.x,
      item.position.y + h / 2,
      item.position.z,
    )
    pipe.parent = parent
    pipe.material = metalMat
    shadowGen.addShadowCaster(pipe)
    const cap = MeshBuilder.CreateSphere(
      `ventCap-${item.id}`,
      { diameter: r * 2.4, segments: 10 },
      scene,
    )
    cap.position = new Vector3(
      item.position.x,
      item.position.y + h + r * 0.4,
      item.position.z,
    )
    cap.scaling.y = 0.45
    cap.parent = parent
    cap.material = metalMat
    return
  }

  if (item.kind === 'ac') {
    const w = item.widthM ?? 0.9
    const d = item.depthM ?? 0.45
    const h = item.heightM ?? 0.55
    const box = MeshBuilder.CreateBox(
      `ac-${item.id}`,
      { width: w, height: h, depth: d },
      scene,
    )
    box.position = new Vector3(
      item.position.x,
      item.position.y + h / 2,
      item.position.z,
    )
    box.parent = parent
    const acMat = new StandardMaterial(`acMat-${item.id}`, scene)
    acMat.diffuseColor = new Color3(0.78, 0.8, 0.84)
    acMat.specularColor = new Color3(0.4, 0.4, 0.45)
    box.material = acMat
    box.receiveShadows = true
    shadowGen.addShadowCaster(box)
    // Grill face
    const grill = MeshBuilder.CreateBox(
      `acGrill-${item.id}`,
      { width: w * 0.85, height: h * 0.55, depth: 0.03 },
      scene,
    )
    grill.position = new Vector3(
      item.position.x,
      item.position.y + h * 0.55,
      item.position.z + d / 2 + 0.02,
    )
    grill.parent = parent
    const gMat = new StandardMaterial(`acGrillMat-${item.id}`, scene)
    gMat.diffuseColor = new Color3(0.25, 0.28, 0.32)
    grill.material = gMat
  }
}

import {
  ArcRotateCamera,
  Color3,
  Mesh,
  MeshBuilder,
  PointerDragBehavior,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import { resolveGableMount } from '../geometry/gableMount'
import { validateObstaclePlacement } from '../geometry/obstacleValidator'
import type { RoofObstacle } from '../geometry/obstacleTypes'
import type { FootprintPoint, RoofPanel, ShapeDims } from '../types'
import type { RoofMaterials } from './materials'

export type ObstacleDragCallbacks = {
  onSelect: (id: string) => void
  onMove: (id: string, x: number, z: number) => void
  onInvalidDrop: (id: string, reason: string) => void
  onDragStart?: () => void
  onDragEnd?: () => void
}

export type ObstacleMountOpts = {
  mode: 'flat' | 'gable'
  wallHeight: number
  shape: ShapeDims
  setbackM: number
  panels: RoofPanel[]
  clearanceM: number
}

const SNAP = 0.25

/** Toggle: set window.__OBSTACLE_DRAG_DEBUG = false to silence. */
function obsLog(...args: unknown[]): void {
  if (typeof window !== 'undefined' && (window as unknown as { __OBSTACLE_DRAG_DEBUG?: boolean }).__OBSTACLE_DRAG_DEBUG === false) {
    return
  }
  console.log('[ObstacleDrag]', ...args)
}

/**
 * Editable roof obstacles with drag-on-roof-plane.
 * Invalid drop reverts to last valid XZ and flashes red.
 */
export function buildObstacles(
  scene: Scene,
  parent: TransformNode,
  obstacles: RoofObstacle[],
  selectedId: string | null,
  footprint: FootprintPoint[],
  mats: RoofMaterials,
  camera: ArcRotateCamera,
  shadowGen: ShadowGenerator | null,
  cbs: ObstacleDragCallbacks,
  mount: ObstacleMountOpts,
): Mesh[] {
  const meshes: Mesh[] = []
  const flashMat = new StandardMaterial('obstacleFlash', scene)
  flashMat.emissiveColor = new Color3(0.95, 0.12, 0.08)
  flashMat.diffuseColor = new Color3(0.95, 0.2, 0.12)

  const stairMat = makeStd(scene, 'stairObs', '#C4B8A8', 0.18)
  const chimneyMat = makeStd(scene, 'chimneyObs', '#7A4E3C', 0.12)
  const acBodyMat = makeStd(scene, 'acBody', '#D0D5DB', 0.35)
  const acDarkMat = makeStd(scene, 'acDark', '#3A4048', 0.15)
  const acGrillMat = makeStd(scene, 'acGrill', '#8A929C', 0.4)

  obsLog('buildObstacles', {
    count: obstacles.length,
    selectedId,
    mode: mount.mode,
    setbackM: mount.setbackM,
    ids: obstacles.map((o) => o.id),
  })

  for (const obs of obstacles) {
    const root = new TransformNode(`obstacleRoot-${obs.id}`, scene)
    root.parent = parent
    root.rotation.y = obs.type === 'water_tank' ? 0 : obs.yawRad

    const setRootXz = (x: number, z: number) => {
      let y = obs.position.y
      if (mount.mode === 'gable') {
        y = resolveGableMount(x, z, mount.shape, mount.wallHeight).y
      } else {
        y = mount.wallHeight + 0.12
      }
      root.position.set(x, y, z)
    }
    setRootXz(obs.position.x, obs.position.z)

    let flashTarget: Mesh
    if (obs.type === 'water_tank') {
      flashTarget = buildWaterTank(scene, root, obs, mats, shadowGen)
    } else if (obs.type === 'ac_unit') {
      flashTarget = buildAcUnit(
        scene,
        root,
        obs,
        acBodyMat,
        acDarkMat,
        acGrillMat,
        shadowGen,
      )
    } else {
      const mat = obs.type === 'stair_room' ? stairMat : chimneyMat
      flashTarget = MeshBuilder.CreateBox(
        `obsBody-${obs.id}`,
        { width: obs.widthM, height: obs.heightM, depth: obs.depthM },
        scene,
      )
      flashTarget.position.y = obs.heightM / 2 + 0.02
      flashTarget.parent = root
      flashTarget.material = mat
      flashTarget.receiveShadows = true
      flashTarget.isPickable = false
      shadowGen?.addShadowCaster(flashTarget)
      if (obs.type === 'chimney') {
        const cap = MeshBuilder.CreateBox(
          `chimCap-${obs.id}`,
          {
            width: obs.widthM * 1.15,
            height: 0.08,
            depth: obs.depthM * 1.15,
          },
          scene,
        )
        cap.position.y = obs.heightM + 0.06
        cap.parent = root
        cap.material = mats.concrete
        cap.isPickable = false
        shadowGen?.addShadowCaster(cap)
      }
    }

    if (selectedId === obs.id) {
      flashTarget.enableEdgesRendering()
      flashTarget.edgesWidth = 2.8
      flashTarget.edgesColor = Color3.FromHexString('#f59e0b').toColor4(1)
    }

    // CRITICAL: Babylon skips meshes with visibility===0 for picking.
    // Drag on the visible body itself (not an invisible hit box).
    const bodyLocalY = flashTarget.position.y
    flashTarget.isPickable = true
    flashTarget.isVisible = true
    flashTarget.visibility = 1
    flashTarget.metadata = { obstacleId: obs.id }

    const drag = new PointerDragBehavior({
      dragPlaneNormal: Vector3.Up(),
    })
    drag.useObjectOrientationForDragging = false
    drag.updateDragPlane = true
    let lastValid = { x: obs.position.x, z: obs.position.z }
    let draggingLocal = false
    let dragMoveLogs = 0

    const syncRootFromBodyWorld = (label: string) => {
      const wp = flashTarget.getAbsolutePosition()
      const parentNode = root.parent as TransformNode | null
      let lx = wp.x
      let lz = wp.z
      if (parentNode) {
        const inv = parentNode.getWorldMatrix().clone()
        inv.invert()
        const local = Vector3.TransformCoordinates(wp, inv)
        lx = local.x
        lz = local.z
      }
      const x = Math.round(lx / SNAP) * SNAP
      const z = Math.round(lz / SNAP) * SNAP
      setRootXz(x, z)
      // Re-center body under root (PointerDragBehavior moves the attached mesh)
      flashTarget.position.x = 0
      flashTarget.position.z = 0
      flashTarget.position.y = bodyLocalY
      if (label === 'move' && dragMoveLogs < 8) {
        dragMoveLogs++
        obsLog('drag/move', {
          id: obs.id,
          world: { x: wp.x, z: wp.z },
          localSnapped: { x, z },
          rootY: root.position.y,
        })
      }
      return { x, z }
    }

    drag.onDragStartObservable.add(() => {
      draggingLocal = true
      dragMoveLogs = 0
      // Lock rebuild BEFORE select (select would otherwise sync/dispose mid-drag)
      cbs.onDragStart?.()
      obsLog('drag/start', {
        id: obs.id,
        type: obs.type,
        root: { x: root.position.x, y: root.position.y, z: root.position.z },
        body: flashTarget.name,
        pickable: flashTarget.isPickable,
        visibility: flashTarget.visibility,
      })
      camera.detachControl()
      lastValid = { x: root.position.x, z: root.position.z }
      cbs.onSelect(obs.id)
    })

    drag.onDragObservable.add(() => {
      if (!draggingLocal) return
      syncRootFromBodyWorld('move')
    })

    drag.onDragEndObservable.add(() => {
      draggingLocal = false
      camera.attachControl(true)
      const { x, z } = syncRootFromBodyWorld('end')

      const candidate: RoofObstacle = {
        ...obs,
        position: { x, y: root.position.y, z },
      }
      const check = validateObstaclePlacement(
        footprint,
        mount.setbackM,
        candidate,
        obstacles,
        obs.id,
        {
          panels: mount.panels,
          clearanceM: mount.clearanceM,
        },
      )
      obsLog('drag/end', {
        id: obs.id,
        drop: { x, z },
        lastValid,
        valid: check.ok,
        reason: check.ok ? null : check.reason,
      })
      if (!check.ok) {
        setRootXz(lastValid.x, lastValid.z)
        flashTarget.position.x = 0
        flashTarget.position.z = 0
        flashTarget.position.y = bodyLocalY
        const prev = flashTarget.material
        flashTarget.material = flashMat
        window.setTimeout(() => {
          if (!flashTarget.isDisposed()) flashTarget.material = prev
        }, 450)
        cbs.onDragEnd?.()
        cbs.onInvalidDrop(obs.id, check.reason)
        return
      }
      lastValid = { x, z }
      cbs.onDragEnd?.()
      cbs.onMove(obs.id, x, z)
      obsLog('drag/committed', { id: obs.id, x, z })
    })

    flashTarget.addBehavior(drag)
    obsLog('drag/attached', {
      id: obs.id,
      mesh: flashTarget.name,
      pickable: flashTarget.isPickable,
      visibility: flashTarget.visibility,
      behaviors: flashTarget.behaviors.length,
    })
    meshes.push(flashTarget)
  }

  return meshes
}

/** Black Sintex-style water tank — stand, ribs, dome, filler cap. */
function buildWaterTank(
  scene: Scene,
  root: TransformNode,
  obs: RoofObstacle,
  mats: RoofMaterials,
  shadowGen: ShadowGenerator | null,
): Mesh {
  const dia = obs.widthM
  const bodyH = obs.heightM
  const id = obs.id

  const stand = MeshBuilder.CreateCylinder(
    `tankStand-${id}`,
    { height: 0.12, diameter: dia * 1.14, tessellation: 24 },
    scene,
  )
  stand.position.y = 0.06
  stand.parent = root
  stand.material = mats.plinth
  stand.isPickable = false
  shadowGen?.addShadowCaster(stand)

  const body = MeshBuilder.CreateCylinder(
    `tankBody-${id}`,
    { height: bodyH, diameter: dia, tessellation: 32 },
    scene,
  )
  body.position.y = 0.12 + bodyH / 2
  body.parent = root
  body.material = mats.tank
  body.receiveShadows = true
  body.isPickable = false
  shadowGen?.addShadowCaster(body)

  for (const t of [0.22, 0.48, 0.74]) {
    const band = MeshBuilder.CreateTorus(
      `tankBand-${id}-${t}`,
      { diameter: dia * 1.02, thickness: 0.04, tessellation: 32 },
      scene,
    )
    band.position.y = 0.12 + bodyH * t
    band.rotation.x = Math.PI / 2
    band.parent = root
    band.material = mats.panelPillar
    band.isPickable = false
    shadowGen?.addShadowCaster(band)
  }

  const lid = MeshBuilder.CreateSphere(
    `tankLid-${id}`,
    { diameterX: dia * 1.02, diameterY: dia * 0.38, diameterZ: dia * 1.02 },
    scene,
  )
  lid.position.y = 0.12 + bodyH + 0.02
  lid.parent = root
  lid.material = mats.tank
  lid.isPickable = false
  shadowGen?.addShadowCaster(lid)

  const rim = MeshBuilder.CreateTorus(
    `tankRim-${id}`,
    { diameter: dia * 0.92, thickness: 0.045, tessellation: 28 },
    scene,
  )
  rim.position.y = 0.12 + bodyH + 0.02
  rim.rotation.x = Math.PI / 2
  rim.parent = root
  rim.material = mats.panelPillar
  rim.isPickable = false

  const cap = MeshBuilder.CreateCylinder(
    `tankCap-${id}`,
    { height: 0.09, diameter: 0.28, tessellation: 14 },
    scene,
  )
  cap.position.y = 0.12 + bodyH + dia * 0.22
  cap.parent = root
  cap.material = mats.plinth
  cap.isPickable = false
  shadowGen?.addShadowCaster(cap)

  return body
}

/** Rooftop split AC outdoor unit — chassis, grille, fan ring, feet. */
function buildAcUnit(
  scene: Scene,
  root: TransformNode,
  obs: RoofObstacle,
  bodyMat: StandardMaterial,
  darkMat: StandardMaterial,
  grillMat: StandardMaterial,
  shadowGen: ShadowGenerator | null,
): Mesh {
  const id = obs.id
  const w = obs.widthM
  const d = obs.depthM
  const h = obs.heightM

  const body = MeshBuilder.CreateBox(
    `acBody-${id}`,
    { width: w, height: h, depth: d },
    scene,
  )
  body.position.y = h / 2 + 0.06
  body.parent = root
  body.material = bodyMat
  body.receiveShadows = true
  body.isPickable = false
  shadowGen?.addShadowCaster(body)

  // Front intake grille (thin plate on +Z face)
  const grill = MeshBuilder.CreateBox(
    `acGrill-${id}`,
    { width: w * 0.88, height: h * 0.72, depth: 0.04 },
    scene,
  )
  grill.position = new Vector3(0, h / 2 + 0.06, d / 2 + 0.01)
  grill.parent = root
  grill.material = grillMat
  grill.isPickable = false

  for (let i = 0; i < 5; i++) {
    const slot = MeshBuilder.CreateBox(
      `acSlot-${id}-${i}`,
      { width: w * 0.8, height: 0.025, depth: 0.02 },
      scene,
    )
    slot.position = new Vector3(
      0,
      h * 0.25 + i * (h * 0.12) + 0.06,
      d / 2 + 0.03,
    )
    slot.parent = root
    slot.material = darkMat
    slot.isPickable = false
  }

  // Top fan ring + hub
  const fanR = Math.min(w, d) * 0.32
  const ring = MeshBuilder.CreateTorus(
    `acFan-${id}`,
    { diameter: fanR * 2, thickness: 0.035, tessellation: 24 },
    scene,
  )
  ring.position.y = h + 0.08
  ring.rotation.x = Math.PI / 2
  ring.parent = root
  ring.material = darkMat
  ring.isPickable = false
  shadowGen?.addShadowCaster(ring)

  const hub = MeshBuilder.CreateCylinder(
    `acHub-${id}`,
    { height: 0.05, diameter: fanR * 0.45, tessellation: 12 },
    scene,
  )
  hub.position.y = h + 0.08
  hub.parent = root
  hub.material = darkMat
  hub.isPickable = false

  // Corner feet
  const footH = 0.06
  const footD = 0.08
  for (const [fx, fz] of [
    [-w * 0.38, -d * 0.38],
    [w * 0.38, -d * 0.38],
    [-w * 0.38, d * 0.38],
    [w * 0.38, d * 0.38],
  ] as const) {
    const foot = MeshBuilder.CreateBox(
      `acFoot-${id}-${fx}`,
      { width: footD, height: footH, depth: footD },
      scene,
    )
    foot.position = new Vector3(fx, footH / 2, fz)
    foot.parent = root
    foot.material = darkMat
    foot.isPickable = false
    shadowGen?.addShadowCaster(foot)
  }

  return body
}

function makeStd(
  scene: Scene,
  name: string,
  hexColor: string,
  spec: number,
): StandardMaterial {
  const m = new StandardMaterial(name, scene)
  const n = hexColor.replace('#', '')
  const r = parseInt(n.slice(0, 2), 16) / 255
  const g = parseInt(n.slice(2, 4), 16) / 255
  const b = parseInt(n.slice(4, 6), 16) / 255
  m.diffuseColor = new Color3(r, g, b)
  m.emissiveColor = new Color3(r, g, b).scale(0.22)
  m.specularColor = new Color3(spec, spec, spec)
  return m
}

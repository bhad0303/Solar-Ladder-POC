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
import { resolveGableMount, type GableMount } from '../geometry/gableMount'
import type { RoofObstacle } from '../geometry/obstacleTypes'
import { validatePanelPlacement } from '../geometry/panelValidator'
import type { FootprintPoint, PanelSettings, RoofPanel, ShapeDims } from '../types'
import { panelMatsForModule, type RoofMaterials } from './materials'

export type PanelDragCallbacks = {
  onSelect: (id: string) => void
  onMove: (id: string, x: number, z: number) => void
  onInvalidDrop: (id: string, reason: string) => void
  onDragStart?: () => void
  onDragEnd?: () => void
}

export type PanelMountOpts = {
  /** flat = canopy on 4 pillars; gable = flush on slope (no pillars) */
  mode: 'canopy' | 'flush'
  wallHeight: number
  shape: ShapeDims
  obstacles?: RoofObstacle[]
}

const SNAP = 0.25
const FRAME = 0.035
const FACE_H = 0.04
/** Flat canopy: low-side post height (m above roof deck) */
const POST_LOW_H = 0.52
const BEAM_H = 0.045
const BEAM_T = 0.04
const PILLAR_D = 0.055
/** Inset posts from panel outer edge so legs sit under the frame */
const POST_INSET = 0.1
/** Tiny gap so rails/clamps read as attached, not intersecting */
const CLAMP_GAP = 0.015

/**
 * Flat: modules on 4 pillars. Gable: flush on roof slope (no pillars).
 */
export function buildPanels(
  scene: Scene,
  parent: TransformNode,
  panels: RoofPanel[],
  selectedId: string | null,
  footprint: FootprintPoint[],
  settings: PanelSettings,
  mats: RoofMaterials,
  camera: ArcRotateCamera,
  shadowGen: ShadowGenerator | null,
  cbs: PanelDragCallbacks,
  mount: PanelMountOpts,
): Mesh[] {
  const meshes: Mesh[] = []
  const flashMat = new StandardMaterial('panelFlash', scene)
  flashMat.emissiveColor = new Color3(0.9, 0.15, 0.1)
  flashMat.diffuseColor = new Color3(0.9, 0.2, 0.15)

  const flush = mount.mode === 'flush'

  for (const panel of panels) {
    let gable: GableMount | null = null
    if (flush) {
      gable = resolveGableMount(
        panel.position.x,
        panel.position.z,
        mount.shape,
        mount.wallHeight,
      )
    }

    const root = new TransformNode(`panelRoot-${panel.id}`, scene)
    root.parent = parent
    root.position = new Vector3(
      panel.position.x,
      gable ? gable.y : panel.position.y,
      panel.position.z,
    )
    // Flush gable: yaw aligns with ridge; flat uses panel azimuth
    root.rotation.y = flush && gable ? gable.yaw : (panel.azimuthDeg * Math.PI) / 180

    const tilt = new TransformNode(`panelTilt-${panel.id}`, scene)
    tilt.parent = root
    let moduleLift = 0
    let hitY = 0.2
    if (flush && gable) {
      tilt.rotation.x = gable.rotX
      tilt.rotation.z = gable.rotZ
      tilt.position.set(0, 0, 0)
      moduleLift = 0.14
      hitY = moduleLift + 0.05
    } else {
      // —— Flat canopy: 4 corner posts (unequal height for tilt) + perimeter rails
      //    + clamps under the module so pillars and panel read as one assembly ——
      const tiltRad = (panel.tiltDeg * Math.PI) / 180
      const sinT = Math.sin(tiltRad)
      const halfW = Math.max(0.15, panel.widthM / 2 - POST_INSET)
      const halfD = Math.max(0.15, panel.heightM / 2 - POST_INSET)
      // With rotX = -tilt, +Z edge rises → back posts taller
      const rise = halfD * 2 * sinT
      const postLow = POST_LOW_H
      const postHigh = POST_LOW_H + rise

      const corners: Array<{ lx: number; lz: number; h: number }> = [
        { lx: -halfW, lz: -halfD, h: postLow },
        { lx: halfW, lz: -halfD, h: postLow },
        { lx: -halfW, lz: halfD, h: postHigh },
        { lx: halfW, lz: halfD, h: postHigh },
      ]

      for (const c of corners) {
        const h = Math.max(0.18, c.h)
        const pillar = MeshBuilder.CreateCylinder(
          `pillar-${panel.id}-${c.lx}-${c.lz}`,
          { height: h, diameter: PILLAR_D, tessellation: 10 },
          scene,
        )
        pillar.position = new Vector3(c.lx, h / 2, c.lz)
        pillar.parent = root
        pillar.material = mats.panelPillar
        pillar.isPickable = false
        shadowGen?.addShadowCaster(pillar)

        // Cap plate + clamp on post top (touches panel underside)
        const cap = MeshBuilder.CreateBox(
          `pillarCap-${panel.id}-${c.lx}-${c.lz}`,
          { width: PILLAR_D * 1.7, height: 0.028, depth: PILLAR_D * 1.7 },
          scene,
        )
        cap.position = new Vector3(c.lx, h + 0.014, c.lz)
        cap.parent = root
        cap.material = mats.panelFrame
        cap.isPickable = false

        const clamp = MeshBuilder.CreateBox(
          `clamp-${panel.id}-${c.lx}-${c.lz}`,
          { width: 0.08, height: 0.04, depth: 0.08 },
          scene,
        )
        clamp.position = new Vector3(c.lx, h + 0.048, c.lz)
        clamp.parent = root
        clamp.material = mats.panelFrame
        clamp.isPickable = false
      }

      // Side rails (along depth, tilted) connecting low→high posts
      const railLen = halfD * 2
      const railMidY = (postLow + postHigh) / 2 + BEAM_H / 2
      for (const lx of [-halfW, halfW] as const) {
        const rail = MeshBuilder.CreateBox(
          `railZ-${panel.id}-${lx}`,
          { width: BEAM_T, height: BEAM_H, depth: railLen + BEAM_T },
          scene,
        )
        rail.position = new Vector3(lx, railMidY, 0)
        rail.rotation.x = -tiltRad
        rail.parent = root
        rail.material = mats.panelPillar
        rail.isPickable = false
        shadowGen?.addShadowCaster(rail)
      }

      // Cross rails at low and high edges (horizontal, span width)
      const crossSpecs = [
        { lz: -halfD, y: postLow + BEAM_H / 2 },
        { lz: halfD, y: postHigh + BEAM_H / 2 },
      ]
      for (const cs of crossSpecs) {
        const rail = MeshBuilder.CreateBox(
          `railX-${panel.id}-${cs.lz}`,
          { width: halfW * 2 + BEAM_T, height: BEAM_H, depth: BEAM_T },
          scene,
        )
        rail.position = new Vector3(0, cs.y, cs.lz)
        rail.parent = root
        rail.material = mats.panelPillar
        rail.isPickable = false
        shadowGen?.addShadowCaster(rail)
      }

      // Mid purlin under panel (tilted, along width)
      const purlin = MeshBuilder.CreateBox(
        `purlin-${panel.id}`,
        { width: halfW * 2 + BEAM_T * 0.5, height: BEAM_H * 0.85, depth: BEAM_T },
        scene,
      )
      purlin.position = new Vector3(0, railMidY, 0)
      purlin.rotation.x = -tiltRad
      purlin.parent = root
      purlin.material = mats.panelPillar
      purlin.isPickable = false
      shadowGen?.addShadowCaster(purlin)

      // Panel rests on the plane through post tops / clamps
      const planeY = postLow + rise / 2
      tilt.position.y = planeY + CLAMP_GAP + 0.05
      tilt.rotation.x = -tiltRad
      moduleLift = FACE_H / 2 + 0.006
      hitY = planeY + CLAMP_GAP + 0.05
    }

    const frame = MeshBuilder.CreateBox(
      `panelFrame-${panel.id}`,
      {
        width: panel.widthM + FRAME * 2,
        height: FACE_H + 0.02,
        depth: panel.heightM + FRAME * 2,
      },
      scene,
    )
    const { face: faceMat, frame: frameMat } = panelMatsForModule(
      mats,
      settings.moduleType,
    )

    frame.parent = tilt
    frame.position.y = moduleLift
    frame.material = frameMat
    frame.isPickable = false
    shadowGen?.addShadowCaster(frame)

    const face = MeshBuilder.CreateBox(
      `panel-${panel.id}`,
      {
        width: panel.widthM,
        height: FACE_H,
        depth: panel.heightM,
      },
      scene,
    )
    face.parent = tilt
    face.position.y = moduleLift + 0.012
    face.material = faceMat
    face.metadata = { panelId: panel.id }
    face.isPickable = false
    shadowGen?.addShadowCaster(face)

    if (panel.conflict) {
      face.enableEdgesRendering()
      face.edgesWidth = 3
      face.edgesColor = Color3.FromHexString('#ef4444').toColor4(1)
      frame.enableEdgesRendering()
      frame.edgesWidth = 2
      frame.edgesColor = Color3.FromHexString('#f87171').toColor4(1)
    } else if (selectedId === panel.id) {
      face.enableEdgesRendering()
      face.edgesWidth = 2.5
      face.edgesColor = Color3.FromHexString('#0ea5e9').toColor4(1)
      frame.enableEdgesRendering()
      frame.edgesWidth = 1.5
      frame.edgesColor = Color3.FromHexString('#38bdf8').toColor4(1)
    }

    const hit = MeshBuilder.CreateBox(
      `panelHit-${panel.id}`,
      {
        width: panel.widthM + 0.15,
        height: 0.22,
        depth: panel.heightM + 0.15,
      },
      scene,
    )
    hit.parent = flush ? tilt : root
    hit.position.y = hitY
    // visibility 0 = not pickable in Babylon; use tiny alpha instead
    const hitMat = new StandardMaterial(`panelHitMat-${panel.id}`, scene)
    hitMat.alpha = 0.001
    hitMat.disableDepthWrite = true
    hit.material = hitMat
    hit.visibility = 1
    hit.isPickable = true
    hit.metadata = { panelId: panel.id }

    const drag = new PointerDragBehavior({
      dragPlaneNormal: new Vector3(0, 1, 0),
    })
    drag.useObjectOrientationForDragging = false
    let lastValid = { x: panel.position.x, z: panel.position.z }

    const applyXz = (x: number, z: number) => {
      root.position.x = x
      root.position.z = z
      if (flush) {
        const m = resolveGableMount(x, z, mount.shape, mount.wallHeight)
        root.position.y = m.y
        root.rotation.y = m.yaw
        tilt.rotation.x = m.rotX
        tilt.rotation.z = m.rotZ
      } else {
        root.position.y = panel.position.y
      }
    }

    drag.onDragStartObservable.add(() => {
      cbs.onDragStart?.()
      camera.detachControl()
      lastValid = { x: root.position.x, z: root.position.z }
    })

    drag.onDragObservable.add(() => {
      const x = Math.round(root.position.x / SNAP) * SNAP
      const z = Math.round(root.position.z / SNAP) * SNAP
      applyXz(x, z)
    })

    drag.onDragEndObservable.add(() => {
      camera.attachControl(true)
      const yawRad = flush
        ? resolveGableMount(
            root.position.x,
            root.position.z,
            mount.shape,
            mount.wallHeight,
          ).yaw
        : (panel.azimuthDeg * Math.PI) / 180
      const full = validatePanelPlacement(
        footprint,
        settings.setbackM,
        {
          x: root.position.x,
          z: root.position.z,
          widthM: panel.widthM,
          heightM: panel.heightM,
          yawRad,
        },
        panels,
        panel.id,
        mount.obstacles && mount.obstacles.length > 0
          ? {
              obstacles: mount.obstacles,
              clearanceM: settings.obstacleClearanceM ?? 0.3,
            }
          : undefined,
      )
      if (!full.ok) {
        applyXz(lastValid.x, lastValid.z)
        const prev = face.material
        face.material = flashMat
        window.setTimeout(() => {
          if (!face.isDisposed()) face.material = prev
        }, 400)
        cbs.onDragEnd?.()
        cbs.onSelect(panel.id)
        cbs.onInvalidDrop(panel.id, full.reason)
        return
      }
      const nx = root.position.x
      const nz = root.position.z
      cbs.onDragEnd?.()
      cbs.onMove(panel.id, nx, nz)
      cbs.onSelect(panel.id)
    })

    hit.addBehavior(drag)
    meshes.push(hit)
  }

  return meshes
}

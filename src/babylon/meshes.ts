import {
  Color3,
  DirectionalLight,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import {
  allPanels,
  zoneStats,
  type LengthUnit,
  type SolarProject,
  type TreeSpec,
} from '../data/types'
import type { SunDirection } from '../geo/sunMath'
import type { PanelSunAccessResult } from '../sunAccess/sunAccessLogic'
import { buildHouse } from './buildHouse'
import {
  createPanelPbrMaterial,
  createFrameMaterial,
} from './houseMaterials'
import {
  createWorldLabel,
  HOUR_LABEL,
  MEAS_LABEL,
  SUNRISE_LABEL,
} from './labels'
import {
  createBarkMaterial,
  createLeafCanopyMaterial,
  createPanelCellTexture,
} from './proceduralTextures'

/** Visual scale so panels read closer to Solar Ladder module size. */
const PANEL_VISUAL_SCALE = 1.2

export type SceneContentHandles = {
  root: TransformNode
  panelMeshes: Map<string, Mesh>
  labelNodes: TransformNode[]
}

/**
 * Original scene geometry guided by public Solar Ladder visual behaviour
 * (Confirmed via REA on public viewer — not a code copy):
 * - House: extruded footprint + parapet polygon + roof slab
 * - Trees: cylinder trunk (≈24 segs) + tapered cylinder crown (≈8 segs) + leaf fill
 * - Tanks: body cylinder + cone + cap
 * - Panels: thin boxes with cell-grid material + mount legs
 * - Shadows: casters on house/panels/trees; ground receives
 */
export function buildSceneContent(
  scene: Scene,
  project: SolarProject,
  shadowGen: ShadowGenerator,
  opts: {
    showLabels: boolean
    showMeasurements: boolean
    lengthUnit: LengthUnit
  },
): SceneContentHandles {
  const root = new TransformNode('projectRoot', scene)
  const panelMeshes = new Map<string, Mesh>()
  const labelNodes: TransformNode[] = []

  const off = project.buildingOffsetMeters
  root.position.x = off.x
  root.position.z = off.z

  const H = project.building.height
  const poly = project.building.polygon
  const minZ = Math.min(...poly.map((p) => p.z))

  buildHouse(scene, root, shadowGen, project.building, project.roofItems)

  // Neighbours
  for (const n of project.neighbours) {
    const nxs = n.polygon.map((p) => p.x)
    const nzs = n.polygon.map((p) => p.z)
    const nw = Math.max(...nxs) - Math.min(...nxs)
    const nd = Math.max(...nzs) - Math.min(...nzs)
    const ncx = (Math.min(...nxs) + Math.max(...nxs)) / 2
    const ncz = (Math.min(...nzs) + Math.max(...nzs)) / 2
    const box = MeshBuilder.CreateBox(
      `neighbour-${n.id}`,
      { width: nw, height: n.height, depth: nd },
      scene,
    )
    box.position = new Vector3(ncx, n.height / 2, ncz)
    box.parent = root
    box.receiveShadows = true
    const nm = new StandardMaterial(`nMat-${n.id}`, scene)
    nm.diffuseColor = new Color3(0.72, 0.7, 0.66)
    nm.emissiveColor = new Color3(0.05, 0.05, 0.05)
    box.material = nm
    shadowGen.addShadowCaster(box)
  }

  // Boundary wall
  if (project.boundaryWall) {
    const bw = project.boundaryWall
    const pts = bw.points
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!
      const b = pts[(i + 1) % pts.length]!
      const len = Math.hypot(b.x - a.x, b.z - a.z)
      const mid = new Vector3((a.x + b.x) / 2, bw.heightM / 2, (a.z + b.z) / 2)
      const seg = MeshBuilder.CreateBox(
        `boundary-${i}`,
        { width: len, height: bw.heightM, depth: bw.thicknessM },
        scene,
      )
      seg.position = mid
      seg.rotation.y = Math.atan2(b.x - a.x, b.z - a.z)
      seg.parent = root
      seg.receiveShadows = true
      const bm = new StandardMaterial(`boundaryMat-${i}`, scene)
      bm.diffuseColor = new Color3(0.75, 0.72, 0.68)
      seg.material = bm
      shadowGen.addShadowCaster(seg)
    }
  }

  // Trees — Confirmed style: cylinder trunk + tapered 8-seg cylinder crown
  const barkMat = createBarkMaterial(scene, 'barkShared')
  const leafMat = createLeafCanopyMaterial(scene, 'leafShared')
  for (const t of project.trees) {
    buildTree(scene, root, shadowGen, t, barkMat, leafMat)
  }

  // Solar panels — PBR + clear coat over cell texture (Babylon skill materials)
  const cellTex = createPanelCellTexture(scene, 'panelCellShared')
  const panelMat = createPanelPbrMaterial(scene, 'panelPbrShared', cellTex)
  const frameMat = createFrameMaterial(scene, 'panelFrameMat', '#c8ccd4')
  const legMat = new StandardMaterial('panelLegMat', scene)
  legMat.diffuseColor = new Color3(0.4, 0.42, 0.45)
  legMat.specularColor = new Color3(0.35, 0.35, 0.38)

  for (const panel of allPanels(project)) {
    const pw = panel.widthM * PANEL_VISUAL_SCALE
    const ph = panel.heightM * PANEL_VISUAL_SCALE
    const group = new TransformNode(`panelGroup-${panel.id}`, scene)
    group.parent = root
    group.position = new Vector3(
      panel.position.x,
      panel.position.y,
      panel.position.z,
    )
    // Azimuth from north CW; tilt from horizontal
    group.rotation.y = (panel.azimuthDeg * Math.PI) / 180
    group.rotation.x = (-panel.tiltDeg * Math.PI) / 180

    // Silver frame body
    const frame = MeshBuilder.CreateBox(
      `frame-${panel.id}`,
      {
        width: pw + 0.05,
        height: 0.045,
        depth: ph + 0.05,
      },
      scene,
    )
    frame.parent = group
    frame.material = frameMat
    frame.receiveShadows = true
    shadowGen.addShadowCaster(frame)

    // Cell face as plane so DynamicTexture UVs read clearly
    const face = MeshBuilder.CreatePlane(
      `panel-${panel.id}`,
      { width: pw, height: ph },
      scene,
    )
    face.rotation.x = Math.PI / 2
    face.position.y = 0.028
    face.parent = group
    face.material = panelMat
    face.receiveShadows = true
    shadowGen.addShadowCaster(face)
    panelMeshes.set(panel.id, face)

    // Mount legs
    const legH = 0.28
    for (const [lx, lz] of [
      [-pw * 0.35, -ph * 0.32],
      [pw * 0.35, -ph * 0.32],
      [-pw * 0.35, ph * 0.32],
      [pw * 0.35, ph * 0.32],
    ] as const) {
      const leg = MeshBuilder.CreateCylinder(
        `leg-${panel.id}-${lx}-${lz}`,
        { height: legH, diameter: 0.04, tessellation: 8 },
        scene,
      )
      leg.position = new Vector3(lx, -legH / 2 - 0.01, lz)
      leg.parent = group
      leg.material = legMat
      shadowGen.addShadowCaster(leg)
    }
  }

  if (opts.showLabels) {
    for (const z of zoneStats(project)) {
      const label = createZoneLabel(
        scene,
        `label-${z.id}`,
        z.name,
        `${z.count} Panels, ${z.kw.toFixed(1)} kW`,
      )
      label.position = new Vector3(0, H + 3.2, minZ - 1.5)
      label.parent = root
      labelNodes.push(label)
    }
  }

  if (opts.showMeasurements) {
    // Dimension lines sit just above the roof parapet (not floating at ground)
    const yLine = H + 0.75
    const yLabel = H + 1.35
    const tick = 0.35
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!
      const b = poly[(i + 1) % poly.length]!
      const distM = Math.hypot(b.x - a.x, b.z - a.z)
      const label =
        opts.lengthUnit === 'ft'
          ? `${(distM * 3.28084).toFixed(1)} ft`
          : `${distM.toFixed(1)} m`
      const mid = new Vector3((a.x + b.x) / 2, yLabel, (a.z + b.z) / 2)
      // Outward offset so labels clear the wall
      const nx = -(b.z - a.z) / (distM || 1)
      const nz = (b.x - a.x) / (distM || 1)
      const ox = nx * 0.55
      const oz = nz * 0.55

      const line = MeshBuilder.CreateLines(
        `meas-${i}`,
        {
          points: [
            new Vector3(a.x + ox, yLine, a.z + oz),
            new Vector3(b.x + ox, yLine, b.z + oz),
          ],
        },
        scene,
      )
      line.color = new Color3(0.2, 0.85, 1)
      line.parent = root

      // End ticks
      const tickA = MeshBuilder.CreateLines(
        `measTickA-${i}`,
        {
          points: [
            new Vector3(a.x + ox, yLine - tick / 2, a.z + oz),
            new Vector3(a.x + ox, yLine + tick / 2, a.z + oz),
          ],
        },
        scene,
      )
      tickA.color = new Color3(0.2, 0.85, 1)
      tickA.parent = root
      const tickB = MeshBuilder.CreateLines(
        `measTickB-${i}`,
        {
          points: [
            new Vector3(b.x + ox, yLine - tick / 2, b.z + oz),
            new Vector3(b.x + ox, yLine + tick / 2, b.z + oz),
          ],
        },
        scene,
      )
      tickB.color = new Color3(0.2, 0.85, 1)
      tickB.parent = root

      // Compact black chip (Babylon skill DynamicTexture; SL-sized, not huge)
      const lbl = createWorldLabel(scene, `measLabel-${i}`, label, MEAS_LABEL)
      lbl.position = mid.add(new Vector3(ox, 0, oz))
      lbl.parent = root
      labelNodes.push(lbl)
    }
  }

  return { root, panelMeshes, labelNodes }
}

function buildTree(
  scene: Scene,
  parent: TransformNode,
  shadowGen: ShadowGenerator,
  t: TreeSpec,
  barkMat: StandardMaterial,
  leafMat: StandardMaterial,
): void {
  const trunk = MeshBuilder.CreateCylinder(
    `trunk-${t.id}`,
    {
      height: t.trunkHeightM,
      diameter: t.trunkRadiusM * 2,
      tessellation: 24,
    },
    scene,
  )
  trunk.position = new Vector3(
    t.position.x,
    t.position.y + t.trunkHeightM / 2,
    t.position.z,
  )
  trunk.parent = parent
  trunk.material = barkMat
  trunk.receiveShadows = true
  shadowGen.addShadowCaster(trunk)

  // Tapered faceted canopy — Confirmed: CreateCylinder diameterTop < diameterBottom, ~8 segs
  const crown = MeshBuilder.CreateCylinder(
    `crown-${t.id}`,
    {
      height: t.canopyHeightM,
      diameterTop: t.canopyRadiusM * 1.1,
      diameterBottom: t.canopyRadiusM * 2,
      tessellation: 8,
    },
    scene,
  )
  crown.position = new Vector3(
    t.position.x,
    t.position.y + t.trunkHeightM + t.canopyHeightM * 0.4,
    t.position.z,
  )
  crown.parent = parent
  crown.material = leafMat
  crown.receiveShadows = true
  shadowGen.addShadowCaster(crown)
}

function createZoneLabel(
  scene: Scene,
  name: string,
  title: string,
  subtitle: string,
): Mesh {
  // Compact teal tooltip (closer to Solar Ladder chip size)
  const plane = MeshBuilder.CreatePlane(name, { width: 4.2, height: 1.05 }, scene)
  const tex = new DynamicTexture(
    `${name}-tex`,
    { width: 512, height: 128 },
    scene,
    false,
  )
  tex.hasAlpha = true
  const ctx = tex.getContext() as CanvasRenderingContext2D
  ctx.clearRect(0, 0, 512, 128)
  ctx.fillStyle = 'rgba(0, 140, 145, 0.92)'
  roundRect(ctx, 6, 6, 500, 116, 10)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 34px sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(title, 28, 44)
  ctx.font = '28px sans-serif'
  ctx.fillText(subtitle, 28, 88)
  tex.update()
  const mat = new StandardMaterial(`${name}-mat`, scene)
  mat.diffuseTexture = tex
  mat.emissiveTexture = tex
  mat.opacityTexture = tex
  mat.backFaceCulling = false
  mat.disableLighting = true
  plane.material = mat
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL
  return plane
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function updatePanelAccessColors(
  handles: SceneContentHandles | null,
  results: PanelSunAccessResult[],
): void {
  if (!handles) return
  for (const r of results) {
    const mesh = handles.panelMeshes.get(r.panelId)
    if (!mesh?.material) continue
    const g = r.accessRatio
    const tint = new Color3(1 - g, 0.15 + g * 0.55, 0.12)
    const mat = mesh.material as StandardMaterial & {
      albedoColor?: Color3
      emissiveIntensity?: number
    }
    if (mat.albedoColor) {
      mat.albedoColor = tint
      mat.emissiveColor = tint.scale(0.25)
    } else {
      mat.diffuseColor = tint
      mat.emissiveColor = new Color3((1 - g) * 0.2, g * 0.15, 0.02)
    }
  }
}

export type SunPathOverlay = {
  path: Mesh | null
  labels: Mesh[]
}

function sunPoint(dir: { x: number; y: number; z: number }, radiusM: number) {
  return new Vector3(
    dir.x * radiusM,
    Math.max(3.5, dir.y * radiusM),
    dir.z * radiusM,
  )
}

export function updateSunVisuals(args: {
  dirLight: DirectionalLight
  sunMarker: Mesh | null
  sunPathMesh: Mesh | null
  sunPathLabels: Mesh[]
  scene: Scene
  sun: SunDirection
  pathSamples: SunDirection[]
  hourMarks: { hour: number; sun: SunDirection }[]
  daylight: {
    sunriseLabel: string
    sunsetLabel: string
    sunriseSun: SunDirection
    sunsetSun: SunDirection
  } | null
  /** Arc radius in meters — keep near the house (~18–24), not sky-far. */
  radiusM: number
}): SunPathOverlay {
  const {
    dirLight,
    sunMarker,
    sun,
    pathSamples,
    hourMarks,
    daylight,
    radiusM,
    scene,
  } = args
  dirLight.direction = new Vector3(-sun.dir.x, -sun.dir.y, -sun.dir.z)
  dirLight.intensity = sun.isUp ? 1.25 : 0.12
  // Light stays farther for shadow quality; marker/path use radiusM
  const lightR = Math.max(radiusM * 1.6, 28)
  dirLight.position = new Vector3(
    sun.dir.x * lightR,
    Math.max(8, sun.dir.y * lightR),
    sun.dir.z * lightR,
  )

  if (sunMarker) {
    sunMarker.position = sunPoint(sun.dir, radiusM)
    sunMarker.setEnabled(sun.isUp)
  }

  args.sunPathMesh?.dispose()
  for (const lbl of args.sunPathLabels) lbl.dispose()

  const labels: Mesh[] = []
  if (pathSamples.length < 2) return { path: null, labels }

  const points = pathSamples.map((s) => sunPoint(s.dir, radiusM))
  const path = MeshBuilder.CreateLines(
    'sunPath',
    {
      points,
      colors: points.map(() => new Color3(1, 0.55, 0.1).toColor4(1)),
    },
    scene,
  )
  path.isPickable = false

  // Hour numerals along the arc (Solar Ladder style)
  for (const mark of hourMarks) {
    const p = sunPoint(mark.sun.dir, radiusM * 1.02)
    const lbl = createWorldLabel(
      scene,
      `sunHour-${mark.hour}`,
      String(mark.hour),
      HOUR_LABEL,
    )
    lbl.position = p
    labels.push(lbl)
  }

  if (daylight) {
    const rise = createWorldLabel(
      scene,
      'sunriseLabel',
      daylight.sunriseLabel,
      SUNRISE_LABEL,
    )
    rise.position = sunPoint(daylight.sunriseSun.dir, radiusM * 1.05)
    labels.push(rise)
    const set = createWorldLabel(
      scene,
      'sunsetLabel',
      daylight.sunsetLabel,
      SUNRISE_LABEL,
    )
    set.position = sunPoint(daylight.sunsetSun.dir, radiusM * 1.05)
    labels.push(set)
  }

  return { path, labels }
}

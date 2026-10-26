import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  ImageProcessingConfiguration,
  MeshBuilder,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core'
import type { RoofObstacle } from '../geometry/obstacleTypes'
import {
  activeShapeDims,
  type FootprintPoint,
  type HouseConfig,
  type LengthUnit,
  type PanelSettings,
  type RoofPanel,
} from '../types'
import { buildDetails } from './buildDetails'
import { buildMassing } from './buildMassing'
import { buildObstacles } from './buildObstacles'
import { buildPanels } from './buildPanels'
import { buildSlopedRoof } from './buildSlopedRoof'
import { AERIAL_GROUND_METERS, createAerialGround } from './aerialGround'
import {
  applyOptionalAlbedoTextures,
  createRoofMaterials,
  setupEnvironment,
  type RoofMaterials,
} from './materials'
import { buildMeasurements } from './measurements'
import { applySun } from './sunPath'

export type RoofSceneState = {
  house: HouseConfig
  footprint: FootprintPoint[]
  panels: RoofPanel[]
  obstacles: RoofObstacle[]
  selectedPanelId: string | null
  selectedObstacleId: string | null
  panelSettings: PanelSettings
  showMeasurements: boolean
  unit: LengthUnit
  sunMinuteOfDay: number
  sunDayOfYear: number
}

export type RoofSceneCallbacks = {
  onSelectPanel: (id: string) => void
  onMovePanel: (id: string, x: number, z: number) => void
  onSelectObstacle: (id: string) => void
  onMoveObstacle: (id: string, x: number, z: number) => void
  onInvalidDrop: (id: string, reason: string) => void
  onMissingTextures?: (paths: string[]) => void
}

export class RoofScene {
  private engine: Engine
  private scene: Scene
  private camera: ArcRotateCamera
  private dirLight: DirectionalLight
  private hemi: HemisphericLight
  private skyMat: StandardMaterial
  private shadowGen: ShadowGenerator
  private mats: RoofMaterials
  private contentRoot: ReturnType<typeof buildMassing>['root'] | null = null
  private sunPath: ReturnType<typeof applySun> | null = null
  private disposed = false
  private cbs: RoofSceneCallbacks
  /** Block full rebuild while a panel is being dragged */
  private dragging = false
  private lastWallHeight = 3
  private lastExtent = 10

  constructor(canvas: HTMLCanvasElement, cbs: RoofSceneCallbacks) {
    this.cbs = cbs
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    })
    this.engine.hideLoadingUI()
    this.scene = new Scene(this.engine)
    this.scene.clearColor = new Color4(0.62, 0.78, 0.94, 1)
    this.scene.ambientColor = new Color3(0.35, 0.38, 0.42)

    this.scene.imageProcessingConfiguration.toneMappingEnabled = true
    this.scene.imageProcessingConfiguration.toneMappingType =
      ImageProcessingConfiguration.TONEMAPPING_ACES
    this.scene.imageProcessingConfiguration.exposure = 1.05
    this.scene.imageProcessingConfiguration.contrast = 1.08

    this.camera = new ArcRotateCamera(
      'cam',
      -Math.PI / 2.4,
      Math.PI / 3.1,
      AERIAL_GROUND_METERS * 0.85,
      new Vector3(0, 2, 0),
      this.scene,
    )
    this.camera.lowerRadiusLimit = 8
    this.camera.upperRadiusLimit = AERIAL_GROUND_METERS * 2.2
    this.camera.upperBetaLimit = Math.PI / 2.05
    this.camera.lowerBetaLimit = 0.15
    this.camera.wheelPrecision = 20
    this.camera.attachControl(canvas, true)

    this.hemi = new HemisphericLight('hemi', new Vector3(0.25, 1, 0.2), this.scene)
    this.hemi.intensity = 0.55
    this.hemi.groundColor = new Color3(0.35, 0.36, 0.32)
    this.hemi.diffuse = new Color3(1, 0.98, 0.95)

    this.dirLight = new DirectionalLight(
      'sun',
      new Vector3(0.45, -1, 0.3),
      this.scene,
    )
    this.dirLight.intensity = 1.45
    this.dirLight.diffuse = new Color3(1, 0.97, 0.9)
    this.dirLight.position = new Vector3(22, 35, -18)
    this.dirLight.shadowEnabled = true

    this.shadowGen = new ShadowGenerator(2048, this.dirLight)
    this.shadowGen.useBlurExponentialShadowMap = true
    this.shadowGen.blurKernel = 48
    this.shadowGen.setDarkness(0.42)
    this.shadowGen.bias = 0.0004

    this.mats = createRoofMaterials(this.scene)

    const sky = MeshBuilder.CreateSphere(
      'skyDome',
      { diameter: 180, segments: 24 },
      this.scene,
    )
    sky.infiniteDistance = true
    this.skyMat = new StandardMaterial('skyMat', this.scene)
    this.skyMat.backFaceCulling = false
    this.skyMat.disableLighting = true
    this.skyMat.emissiveColor = new Color3(0.55, 0.72, 0.92)
    sky.material = this.skyMat
    sky.isPickable = false

    const sceneRef = this.scene
    const matsRef = this.mats
    const cbsRef = this.cbs
    const shadowRef = this.shadowGen
    void (async () => {
      await createAerialGround(sceneRef, matsRef.grass, shadowRef)
      const missingEnv = await setupEnvironment(sceneRef)
      const missingTex = await applyOptionalAlbedoTextures(sceneRef, matsRef)
      if (this.disposed) return
      const all = [...new Set([...missingEnv, ...missingTex])]
      cbsRef.onMissingTextures?.(all)
    })()

    this.engine.runRenderLoop(() => {
      if (!this.disposed) this.scene.render()
    })
    window.addEventListener('resize', this.onResize)
  }

  private onResize = () => this.engine.resize()

  setDragging(v: boolean): void {
    console.log('[ObstacleDrag] RoofScene.setDragging', v, '→ was', this.dragging)
    this.dragging = v
  }

  /** Sun path + lighting only — no house rebuild (slider-friendly). */
  updateSun(state: Pick<RoofSceneState, 'sunDayOfYear' | 'sunMinuteOfDay'>): void {
    this.disposeSunPath()
    this.sunPath = applySun(
      this.scene,
      this.dirLight,
      state.sunDayOfYear,
      state.sunMinuteOfDay,
      new Vector3(0, this.lastWallHeight * 0.5, 0),
      Math.max(10, this.lastExtent * 1.35),
      { hemi: this.hemi, skyMat: this.skyMat },
    )
  }

  private disposeSunPath(): void {
    if (!this.sunPath) return
    this.sunPath.path?.dispose(false, false)
    this.sunPath.marker?.dispose(false, false)
    for (const g of this.sunPath.glow) g.dispose(false, false)
    for (const l of this.sunPath.labels) l.dispose(false, false)
    this.sunPath = null
  }

  sync(state: RoofSceneState): void {
    // Never tear down meshes mid-drag (select/move would otherwise kill PointerDrag)
    if (this.dragging) {
      console.log('[ObstacleDrag] RoofScene.sync SKIPPED (dragging=true)', {
        panels: state.panels.length,
        obstacles: state.obstacles.length,
        selectedObstacleId: state.selectedObstacleId,
      })
      return
    }
    console.log('[ObstacleDrag] RoofScene.sync RUN', {
      panels: state.panels.length,
      obstacles: state.obstacles.length,
      selectedObstacleId: state.selectedObstacleId,
    })

    this.contentRoot?.dispose(false, false)
    this.contentRoot = null
    this.disposeSunPath()

    if (!state.footprint.length) {
      console.warn('[Solar Roof Preview] Empty footprint — house not built')
      return
    }

    const massing = buildMassing(
      this.scene,
      state.footprint,
      state.house,
      this.mats,
      this.shadowGen,
    )
    massing.root.position.y = 0.06
    this.contentRoot = massing.root
    this.lastWallHeight = massing.wallHeight
    this.lastExtent = Math.max(
      ...state.footprint.map((p) => Math.hypot(p.x, p.z)),
      6,
    )

    buildDetails(
      this.scene,
      massing.root,
      state.footprint,
      state.house,
      massing.wallHeight,
      this.mats,
      this.shadowGen,
      { includeTrees: false },
    )

    if (state.house.roofType === 'gable') {
      buildSlopedRoof(
        this.scene,
        massing.root,
        activeShapeDims(state.house),
        state.house,
        massing.wallHeight,
        this.mats,
        this.shadowGen,
      )
    }

    const isGable = state.house.roofType === 'gable'
    const shapeDims = activeShapeDims(state.house)
    const roofY = isGable
      ? massing.wallHeight + 0.06
      : massing.roofY + 0.05

    buildObstacles(
      this.scene,
      massing.root,
      state.obstacles.map((o) => ({
        ...o,
        position: { ...o.position, y: roofY },
      })),
      state.selectedObstacleId,
      state.footprint,
      this.mats,
      this.camera,
      this.shadowGen,
      {
        onSelect: this.cbs.onSelectObstacle,
        onMove: this.cbs.onMoveObstacle,
        onInvalidDrop: this.cbs.onInvalidDrop,
        onDragStart: () => this.setDragging(true),
        onDragEnd: () => this.setDragging(false),
      },
      {
        mode: isGable ? 'gable' : 'flat',
        wallHeight: massing.wallHeight,
        shape: shapeDims,
        setbackM: state.panelSettings.setbackM,
        panels: state.panels,
        clearanceM: state.panelSettings.obstacleClearanceM ?? 0.3,
      },
    )

    const panels = state.panels.map((p) => ({
      ...p,
      position: { ...p.position, y: roofY },
      // Flat uses form tilt; gable follows roof pitch in buildPanels
      tiltDeg: isGable ? 25 : p.tiltDeg,
    }))

    buildPanels(
      this.scene,
      massing.root,
      panels,
      state.selectedPanelId,
      state.footprint,
      state.panelSettings,
      this.mats,
      this.camera,
      this.shadowGen,
      {
        onSelect: this.cbs.onSelectPanel,
        onMove: this.cbs.onMovePanel,
        onInvalidDrop: this.cbs.onInvalidDrop,
        onDragStart: () => this.setDragging(true),
        onDragEnd: () => this.setDragging(false),
      },
      {
        mode: isGable ? 'flush' : 'canopy',
        wallHeight: massing.wallHeight,
        shape: shapeDims,
        obstacles: state.obstacles,
      },
    )

    if (state.showMeasurements) {
      buildMeasurements(
        this.scene,
        massing.root,
        state.footprint,
        roofY,
        state.unit,
      )
    }

    this.updateSun(state)
    this.camera.setTarget(new Vector3(0, massing.wallHeight * 0.45, 0))
  }

  dispose(): void {
    this.disposed = true
    window.removeEventListener('resize', this.onResize)
    this.disposeSunPath()
    this.contentRoot?.dispose(false, false)
    this.engine.dispose()
  }
}

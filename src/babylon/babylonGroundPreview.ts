import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  DynamicTexture,
  Engine,
  GlowLayer,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Texture,
  Vector3,
} from '@babylonjs/core'
import type { LengthUnit, SolarProject } from '../data/types'
import { localImageProvider } from '../imagery/LocalImageProvider'
import {
  getDaylightTimes,
  getSunDirection,
  sampleSunHourMarks,
  sampleSunPathForDay,
} from '../geo/sunMath'
import type { PanelSunAccessResult } from '../sunAccess/sunAccessLogic'
import {
  buildSceneContent,
  type SceneContentHandles,
  updatePanelAccessColors,
  updateSunVisuals,
} from './meshes'

export type GroundPreviewStatus = {
  imageryOk: boolean
  message: string | null
}

/**
 * Local satellite image as ground + Babylon meshes (1 unit = 1 meter).
 * No Google Maps / tiles / API keys.
 */
export class BabylonGroundPreview {
  private engine: Engine | null = null
  private scene: Scene | null = null
  private camera: ArcRotateCamera | null = null
  private handles: SceneContentHandles | null = null
  private sunPathMesh: Mesh | null = null
  private sunPathLabels: Mesh[] = []
  private sunMarker: Mesh | null = null
  /** Guards overlapping async buildGround() calls (leaked grounds = white cross). */
  private groundBuildId = 0
  private dirLight: DirectionalLight | null = null
  private hemiLight: HemisphericLight | null = null
  private shadowGen: ShadowGenerator | null = null
  private glowLayer: GlowLayer | null = null
  private sunHalo: Mesh | null = null
  private ground: Mesh | null = null
  private fallbackBanner: Mesh | null = null
  private dayOfYear = 172
  private minuteOfDay = 720
  private showLabels = true
  private showMeasurements = false
  private showSunAccess = false
  private lengthUnit: LengthUnit = 'm'
  private accessResults: PanelSunAccessResult[] = []
  private project: SolarProject
  private disposed = false
  private resizeCleanup: (() => void) | null = null
  private status: GroundPreviewStatus = { imageryOk: true, message: null }
  onStatus?: (s: GroundPreviewStatus) => void

  constructor(project: SolarProject) {
    this.project = project
  }

  attach(canvas: HTMLCanvasElement): void {
    this.dispose()
    this.disposed = false

    const engine = new Engine(canvas, true, {
      adaptToDeviceRatio: true,
      preserveDrawingBuffer: true,
    })
    engine.hideLoadingUI()
    const scene = new Scene(engine)
    scene.clearColor = new Color4(0.55, 0.62, 0.68, 1)

    // Orbit angle closer to Solar Ladder public preview (~45° look-down)
    const camera = new ArcRotateCamera(
      'cam',
      -Math.PI / 2.6,
      Math.PI / 3.05,
      28,
      new Vector3(0, 2.2, 0),
      scene,
    )
    camera.lowerRadiusLimit = 10
    camera.upperRadiusLimit = 80
    camera.upperBetaLimit = Math.PI / 2.08
    camera.wheelPrecision = 12
    camera.inertia = 0.85
    camera.panningInertia = 0.85
    // Smooth zoom — avoid hard snaps that look like blinks
    camera.wheelDeltaPercentage = 0.012
    camera.attachControl(canvas, true)
    // Keep page from scrolling while zooming the canvas
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault()
      },
      { passive: false },
    )

    const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene)
    hemi.intensity = 0.72
    hemi.groundColor = new Color3(0.35, 0.32, 0.28)
    this.hemiLight = hemi

    const dir = new DirectionalLight('sun', new Vector3(0.4, -1, 0.3), scene)
    dir.intensity = 1.55
    dir.diffuse = new Color3(1, 0.97, 0.9)
    dir.position = new Vector3(25, 40, -15)
    this.dirLight = dir

    scene.imageProcessingConfiguration.contrast = 1.08
    scene.imageProcessingConfiguration.exposure = 1.05

    // Confirmed public SL: ShadowGenerator(1024); we use 2048 for crisper cast
    const shadowGen = new ShadowGenerator(2048, dir)
    shadowGen.useBlurExponentialShadowMap = true
    shadowGen.blurKernel = 24
    shadowGen.setDarkness(0.32)
    shadowGen.bias = 0.00035
    shadowGen.normalBias = 0.015
    this.shadowGen = shadowGen

    // Sun-only glow (include-only mode set when sun meshes are created)
    const glow = new GlowLayer('sunGlow', scene, {
      blurKernelSize: 64,
      mainTextureFixedSize: 256,
    })
    glow.intensity = 0.45
    this.glowLayer = glow

    this.engine = engine
    this.scene = scene
    this.camera = camera
    // Dev: inspect meshes from browser console
    ;(window as unknown as { __solarPreview?: BabylonGroundPreview }).__solarPreview =
      this

    void this.buildGround().then(() => {
      if (this.disposed) return
      this.rebuildContent()
      this.applySun()
      this.onStatus?.(this.status)
    })

    engine.runRenderLoop(() => {
      if (!this.disposed) scene.render()
    })

    const onWinResize = () => engine.resize()
    window.addEventListener('resize', onWinResize)
    this.resizeCleanup = () => window.removeEventListener('resize', onWinResize)
    engine.resize()
  }

  private disposeAllGrounds(): void {
    if (!this.scene) return
    for (const m of [...this.scene.meshes]) {
      if (m.name === 'satGround') m.dispose(false, true)
    }
    this.ground = null
  }

  private async buildGround(): Promise<void> {
    if (!this.scene) return
    const buildId = ++this.groundBuildId
    this.disposeAllGrounds()
    this.fallbackBanner?.dispose()
    this.fallbackBanner = null

    const img = this.project.imagery
    const probe = await localImageProvider.probe(img)
    if (this.disposed || buildId !== this.groundBuildId || !this.scene) return

    // Drop any grounds created by overlapping calls while we awaited
    this.disposeAllGrounds()

    const w = img.widthMeters
    const h = img.heightMeters

    const ground = MeshBuilder.CreateGround(
      'satGround',
      { width: w, height: h, subdivisions: 1 },
      this.scene,
    )
    // Slightly below y=0 so house / plinth never z-fight (blink on orbit/zoom)
    ground.position.y = -0.04
    ground.rotation.y = (img.rotationDeg * Math.PI) / 180
    ground.receiveShadows = true
    ground.renderingGroupId = 0
    ground.isPickable = false

    const gMat = new StandardMaterial('satGroundMat', this.scene)
    gMat.specularColor = new Color3(0, 0, 0)
    gMat.specularPower = 1

    if (probe.ok) {
      const tex = new Texture(probe.url, this.scene, false, true)
      tex.updateSamplingMode(Texture.TRILINEAR_SAMPLINGMODE)
      tex.wrapU = Texture.CLAMP_ADDRESSMODE
      tex.wrapV = Texture.CLAMP_ADDRESSMODE
      gMat.diffuseTexture = tex
      // No emissiveTexture — GlowLayer bloom made triangle seams look like a white cross
      gMat.emissiveColor = new Color3(0.22, 0.22, 0.22)
      this.status = { imageryOk: true, message: null }
    } else {
      gMat.diffuseColor = new Color3(0.28, 0.48, 0.28)
      gMat.emissiveColor = new Color3(0.12, 0.2, 0.12)
      this.status = {
        imageryOk: false,
        message: probe.reason,
      }
      this.fallbackBanner = createTextPlane(
        this.scene,
        'imageryMissing',
        'Place site-satellite.jpg in public/assets/',
        28,
        3,
      )
      this.fallbackBanner.position = new Vector3(0, 8, 0)
    }

    ground.material = gMat
    this.ground = ground
    this.glowLayer?.addExcludedMesh(ground)
  }

  setProject(project: SolarProject): void {
    this.project = project
    void this.buildGround().then(() => {
      if (this.disposed) return
      this.rebuildContent()
      this.applySun()
      this.onStatus?.(this.status)
    })
  }

  setTime(dayOfYear: number, minuteOfDay: number): void {
    this.dayOfYear = dayOfYear
    this.minuteOfDay = minuteOfDay
    this.applySun()
  }

  setToggles(opts: {
    panelInfo?: boolean
    measurements?: boolean
    sunAccess?: boolean
    lengthUnit?: LengthUnit
  }): void {
    if (opts.panelInfo !== undefined) this.showLabels = opts.panelInfo
    if (opts.measurements !== undefined)
      this.showMeasurements = opts.measurements
    if (opts.sunAccess !== undefined) this.showSunAccess = opts.sunAccess
    if (opts.lengthUnit !== undefined) this.lengthUnit = opts.lengthUnit
    this.rebuildContent()
    if (this.showSunAccess && this.accessResults.length) {
      updatePanelAccessColors(this.handles, this.accessResults)
    }
    this.applySun()
  }

  setAccessResults(results: PanelSunAccessResult[]): void {
    this.accessResults = results
    if (this.showSunAccess) updatePanelAccessColors(this.handles, results)
  }

  private rebuildContent(): void {
    if (!this.scene || !this.shadowGen) return
    this.handles?.root.dispose()
    this.sunPathMesh?.dispose()
    for (const lbl of this.sunPathLabels) lbl.dispose()
    this.sunPathLabels = []
    this.sunMarker?.dispose()
    this.sunHalo?.dispose()
    this.sunPathMesh = null
    this.sunMarker = null
    this.sunHalo = null

    this.handles = buildSceneContent(
      this.scene,
      this.project,
      this.shadowGen,
      {
        showLabels: this.showLabels,
        showMeasurements: this.showMeasurements,
        lengthUnit: this.lengthUnit,
      },
    )
    // Sit clearly above ground plane (fixes “under road” / blink z-fight)
    this.handles.root.position.y = 0.08
    for (const m of this.handles.root.getChildMeshes(true)) {
      m.renderingGroupId = 1
    }

    this.sunMarker = MeshBuilder.CreateSphere(
      'sunMarker',
      { diameter: 1.4, segments: 16 },
      this.scene,
    )
    const sunMat = new StandardMaterial('sunMat', this.scene)
    sunMat.emissiveColor = new Color3(1, 0.85, 0.35)
    sunMat.diffuseColor = new Color3(1, 0.9, 0.4)
    sunMat.disableLighting = true
    this.sunMarker.material = sunMat

    this.sunHalo = MeshBuilder.CreateSphere(
      'sunHalo',
      { diameter: 2.4, segments: 12 },
      this.scene,
    )
    const haloMat = new StandardMaterial('sunHaloMat', this.scene)
    haloMat.emissiveColor = new Color3(1, 0.7, 0.25)
    haloMat.alpha = 0.25
    haloMat.disableLighting = true
    this.sunHalo.material = haloMat
    this.sunHalo.parent = this.sunMarker

    this.glowLayer?.addIncludedOnlyMesh(this.sunMarker)
    this.glowLayer?.addIncludedOnlyMesh(this.sunHalo)
    // Keep ground out of glow so satellite image does not wash out
    if (this.ground) this.glowLayer?.removeIncludedOnlyMesh(this.ground)
  }

  private applySun(): void {
    if (!this.scene || !this.dirLight) return
    const loc = this.project.location
    const sun = getSunDirection(
      this.dayOfYear,
      this.minuteOfDay,
      loc.lat,
      loc.lon,
      loc.timeZone,
    )
    const off = this.project.buildingOffsetMeters
    const overlay = updateSunVisuals({
      dirLight: this.dirLight,
      sunMarker: this.sunMarker,
      sunPathMesh: this.sunPathMesh,
      sunPathLabels: this.sunPathLabels,
      scene: this.scene,
      sun,
      pathSamples: sampleSunPathForDay(
        this.dayOfYear,
        loc.lat,
        loc.lon,
        loc.timeZone,
        15,
      ),
      hourMarks: sampleSunHourMarks(
        this.dayOfYear,
        loc.lat,
        loc.lon,
        loc.timeZone,
      ),
      daylight: getDaylightTimes(
        this.dayOfYear,
        loc.lat,
        loc.lon,
        loc.timeZone,
      ),
      // Arc hugs the house (site-relative, stays in frame with the building)
      radiusM: Math.max(
        8,
        Math.min(this.project.imagery.widthMeters, this.project.imagery.heightMeters) * 0.24,
      ),
      origin: new Vector3(off.x, 2.5, off.z),
    })
    this.sunPathMesh = overlay.path
    this.sunPathLabels = overlay.labels
    if (this.sunMarker) {
      this.sunMarker.setEnabled(sun.isUp)
    }
    if (this.hemiLight) {
      // Warm near horizon, cooler midday, dim at night — keep clearColor stable (no blink)
      const alt = sun.altitudeRad
      if (!sun.isUp) {
        this.hemiLight.intensity = 0.15
        this.hemiLight.diffuse = new Color3(0.55, 0.6, 0.75)
      } else if (alt < 0.25) {
        this.hemiLight.intensity = 0.5
        this.hemiLight.diffuse = new Color3(1, 0.75, 0.5)
      } else {
        this.hemiLight.intensity = 0.7
        this.hemiLight.diffuse = new Color3(1, 1, 1)
      }
      this.scene.clearColor = new Color4(0.42, 0.48, 0.55, 1)
    }
  }

  getHeadingDeg(): number {
    if (!this.camera) return 0
    return ((-this.camera.alpha * 180) / Math.PI + 360) % 360
  }

  dispose(): void {
    this.disposed = true
    this.resizeCleanup?.()
    this.resizeCleanup = null
    this.handles?.root.dispose()
    this.handles = null
    this.sunPathMesh?.dispose()
    for (const lbl of this.sunPathLabels) lbl.dispose()
    this.sunPathLabels = []
    this.sunMarker?.dispose()
    this.sunHalo?.dispose()
    this.fallbackBanner?.dispose()
    this.ground?.dispose()
    this.glowLayer?.dispose()
    this.shadowGen?.dispose()
    this.scene?.dispose()
    this.engine?.dispose()
    this.sunPathMesh = null
    this.sunMarker = null
    this.sunHalo = null
    this.fallbackBanner = null
    this.ground = null
    this.glowLayer = null
    this.shadowGen = null
    this.dirLight = null
    this.hemiLight = null
    this.camera = null
    this.scene = null
    this.engine = null
  }
}

function createTextPlane(
  scene: Scene,
  name: string,
  text: string,
  width: number,
  height: number,
): Mesh {
  const plane = MeshBuilder.CreatePlane(name, { width, height }, scene)
  const tex = new DynamicTexture(
    `${name}-tex`,
    { width: 1024, height: 128 },
    scene,
    false,
  )
  tex.hasAlpha = true
  const ctx = tex.getContext() as CanvasRenderingContext2D
  ctx.clearRect(0, 0, 1024, 128)
  ctx.fillStyle = 'rgba(20,40,20,0.85)'
  ctx.fillRect(0, 0, 1024, 128)
  ctx.font = 'bold 40px sans-serif'
  ctx.fillStyle = '#e8ffe8'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 512, 64)
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

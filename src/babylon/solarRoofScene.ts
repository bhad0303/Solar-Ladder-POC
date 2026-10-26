import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
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
import {
  getDaylightTimes,
  getSunDirection,
  sampleSunHourMarks,
  sampleSunPathForDay,
  type SunDirection,
} from '../geo/sunMath'
import { resolveSatelliteTextureUrl } from '../imagery/satelliteGround'
import { layoutPanelsOnPolygon } from '../panels/layoutPanels'
import type { BuildingFootprint, LatLng } from '../types/project'
import {
  buildFootprintHouse,
  type FootprintHouseHandles,
} from './buildFootprintHouse'
import { buildRoofPanels } from './buildRoofPanels'
import { createWorldLabel, HOUR_LABEL, SUNRISE_LABEL } from './labels'
import { JUNE_21_DOY, NOON_MINUTE } from '../geo/coordinates'

export type BuildSceneInput = {
  footprint: BuildingFootprint
  /** Pin / projection origin (same as Find house). */
  origin: LatLng
  timeZone: string
  dayOfYear?: number
  minuteOfDay?: number
}

/**
 * Convert sunMath dir (+X east, +Y up, −Z north) → project frame (+Z north).
 */
function toProjectDir(d: { x: number; y: number; z: number }) {
  return { x: d.x, y: d.y, z: -d.z }
}

function sunPoint(
  dir: { x: number; y: number; z: number },
  radiusM: number,
  origin: Vector3,
) {
  return new Vector3(
    origin.x + dir.x * radiusM,
    origin.y + Math.max(2.5, dir.y * radiusM),
    origin.z + dir.z * radiusM,
  )
}

/**
 * Babylon scene: satellite ground + OSM house + auto panels + sun path.
 */
export class SolarRoofScene {
  private engine: Engine | null = null
  private scene: Scene | null = null
  private camera: ArcRotateCamera | null = null
  private shadowGen: ShadowGenerator | null = null
  private dirLight: DirectionalLight | null = null
  private glowLayer: GlowLayer | null = null
  private house: FootprintHouseHandles | null = null
  private ground: Mesh | null = null
  private sunPathMesh: Mesh | null = null
  private sunPathLabels: Mesh[] = []
  private sunMarker: Mesh | null = null
  private sunHalo: Mesh | null = null
  private disposed = false
  private resizeCleanup: (() => void) | null = null
  private panelCount = 0

  attach(canvas: HTMLCanvasElement): void {
    this.dispose()
    this.disposed = false

    const engine = new Engine(canvas, true, {
      adaptToDeviceRatio: true,
      preserveDrawingBuffer: true,
    })
    const scene = new Scene(engine)
    scene.clearColor = new Color4(0.42, 0.5, 0.56, 1)

    const camera = new ArcRotateCamera(
      'cam',
      -Math.PI / 2.5,
      Math.PI / 3.1,
      40,
      new Vector3(0, 2, 0),
      scene,
    )
    camera.lowerRadiusLimit = 8
    camera.upperRadiusLimit = 220
    camera.upperBetaLimit = Math.PI / 2.05
    camera.wheelPrecision = 6
    camera.attachControl(canvas, true)

    const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene)
    hemi.intensity = 0.72
    hemi.groundColor = new Color3(0.32, 0.3, 0.26)

    const dir = new DirectionalLight('sun', new Vector3(0.45, -1, 0.35), scene)
    dir.intensity = 1.45
    dir.diffuse = new Color3(1, 0.97, 0.9)
    dir.position = new Vector3(30, 50, -20)

    const shadowGen = new ShadowGenerator(2048, dir)
    shadowGen.useBlurExponentialShadowMap = true
    shadowGen.blurKernel = 24
    shadowGen.setDarkness(0.3)
    shadowGen.bias = 0.00035
    shadowGen.normalBias = 0.015

    const glow = new GlowLayer('sunGlow', scene, { blurKernelSize: 64 })
    glow.intensity = 0.55

    scene.imageProcessingConfiguration.contrast = 1.06
    scene.imageProcessingConfiguration.exposure = 1.04

    this.engine = engine
    this.scene = scene
    this.camera = camera
    this.shadowGen = shadowGen
    this.dirLight = dir
    this.glowLayer = glow

    engine.runRenderLoop(() => {
      if (!this.disposed) scene.render()
    })

    const onResize = () => engine.resize()
    window.addEventListener('resize', onResize)
    this.resizeCleanup = () => window.removeEventListener('resize', onResize)
    engine.resize()
  }

  async buildScene(input: BuildSceneInput): Promise<{ panelCount: number }> {
    if (!this.scene || !this.shadowGen || !this.camera || !this.dirLight) {
      throw new Error('Scene not attached')
    }
    this.clearContent()

    const day = input.dayOfYear ?? JUNE_21_DOY
    const minute = input.minuteOfDay ?? NOON_MINUTE
    const tz = input.timeZone || 'Asia/Kolkata'

    await this.buildSatelliteGround(input.origin, input.footprint)

    const house = buildFootprintHouse(
      this.scene,
      this.shadowGen,
      input.footprint,
    )
    this.house = house

    const roofY = house.heightM + 0.14
    const panels = layoutPanelsOnPolygon(
      input.footprint.polygonLocal,
      roofY,
    )
    buildRoofPanels(this.scene, house.root, this.shadowGen, panels)
    this.panelCount = panels.length

    this.createSunMarker(house.center)
    this.applySun(
      input.origin.lat,
      input.origin.lng,
      tz,
      day,
      minute,
      house,
    )

    this.camera.setTarget(house.center)
    this.camera.radius = Math.max(22, house.extent * 2.1)
    this.engine?.resize()

    return { panelCount: this.panelCount }
  }

  private async buildSatelliteGround(
    origin: LatLng,
    footprint: BuildingFootprint,
  ): Promise<void> {
    if (!this.scene) return
    const extent = Math.max(
      ...footprint.polygonLocal.map((p) => Math.hypot(p.x, p.z)),
      20,
    )
    const halfM = Math.max(40, extent + 22)
    const resolved = await resolveSatelliteTextureUrl(origin, halfM)

    const ground = MeshBuilder.CreateGround(
      'satGround',
      { width: resolved.widthM, height: resolved.heightM, subdivisions: 2 },
      this.scene,
    )
    ground.position.y = -0.02
    ground.receiveShadows = true

    const gMat = new StandardMaterial('satGroundMat', this.scene)
    gMat.specularColor = new Color3(0.02, 0.02, 0.02)
    try {
      const tex = new Texture(
        resolved.url,
        this.scene,
        false,
        true,
        Texture.TRILINEAR_SAMPLINGMODE,
        undefined,
        () => {
          gMat.diffuseTexture = null
          gMat.diffuseColor = new Color3(0.28, 0.4, 0.28)
          gMat.emissiveColor = new Color3(0.1, 0.14, 0.1)
        },
      )
      tex.wrapU = Texture.CLAMP_ADDRESSMODE
      tex.wrapV = Texture.CLAMP_ADDRESSMODE
      tex.vScale = -1
      tex.vOffset = 1
      gMat.diffuseTexture = tex
      gMat.emissiveTexture = tex
      gMat.emissiveColor = new Color3(0.2, 0.2, 0.2)
    } catch {
      gMat.diffuseColor = new Color3(0.28, 0.4, 0.28)
    }
    ground.material = gMat
    this.ground = ground
  }

  private createSunMarker(center: Vector3): void {
    if (!this.scene || !this.glowLayer) return
    const sun = MeshBuilder.CreateSphere('sunMarker', { diameter: 1.1 }, this.scene)
    const mat = new StandardMaterial('sunMat', this.scene)
    mat.emissiveColor = new Color3(1, 0.85, 0.25)
    mat.disableLighting = true
    sun.material = mat
    sun.isPickable = false
    this.glowLayer.addIncludedOnlyMesh(sun)
    this.sunMarker = sun

    const halo = MeshBuilder.CreateSphere('sunHalo', { diameter: 2.4 }, this.scene)
    const hMat = new StandardMaterial('sunHaloMat', this.scene)
    hMat.emissiveColor = new Color3(1, 0.6, 0.15)
    hMat.alpha = 0.35
    hMat.disableLighting = true
    halo.material = hMat
    halo.isPickable = false
    this.glowLayer.addIncludedOnlyMesh(halo)
    this.sunHalo = halo

    sun.position.copyFrom(center)
    halo.position.copyFrom(center)
  }

  private applySun(
    lat: number,
    lng: number,
    timezone: string,
    dayOfYear: number,
    minuteOfDay: number,
    house: FootprintHouseHandles,
  ): void {
    if (!this.scene || !this.dirLight) return

    const mapSun = (s: SunDirection): SunDirection => ({
      ...s,
      dir: toProjectDir(s.dir),
    })

    const sun = mapSun(
      getSunDirection(dayOfYear, minuteOfDay, lat, lng, timezone),
    )
    const pathSamples = sampleSunPathForDay(
      dayOfYear,
      lat,
      lng,
      timezone,
    ).map(mapSun)
    const hourMarks = sampleSunHourMarks(dayOfYear, lat, lng, timezone).map(
      (m) => ({ ...m, sun: mapSun(m.sun) }),
    )
    const daylightRaw = getDaylightTimes(dayOfYear, lat, lng, timezone)
    const daylight = {
      sunriseLabel: daylightRaw.sunriseLabel,
      sunsetLabel: daylightRaw.sunsetLabel,
      sunriseSun: mapSun(daylightRaw.sunriseSun),
      sunsetSun: mapSun(daylightRaw.sunsetSun),
    }

    const origin = house.center.clone()
    origin.y = 0
    const radiusM = Math.max(16, house.extent * 1.35)

    this.dirLight.direction = new Vector3(-sun.dir.x, -sun.dir.y, -sun.dir.z)
    this.dirLight.intensity = sun.isUp ? 1.35 : 0.12
    const lightR = Math.max(radiusM * 1.7, 30)
    this.dirLight.position = new Vector3(
      origin.x + sun.dir.x * lightR,
      Math.max(10, sun.dir.y * lightR),
      origin.z + sun.dir.z * lightR,
    )

    if (this.sunMarker) {
      this.sunMarker.position = sunPoint(sun.dir, radiusM, origin)
      this.sunMarker.setEnabled(sun.isUp)
    }
    if (this.sunHalo) {
      this.sunHalo.position = sunPoint(sun.dir, radiusM, origin)
      this.sunHalo.setEnabled(sun.isUp)
    }

    this.sunPathMesh?.dispose()
    for (const lbl of this.sunPathLabels) lbl.dispose()
    this.sunPathLabels = []

    if (pathSamples.length >= 2) {
      const points = pathSamples.map((s) => sunPoint(s.dir, radiusM, origin))
      this.sunPathMesh = MeshBuilder.CreateLines(
        'sunPath',
        {
          points,
          colors: points.map(() => new Color3(1, 0.55, 0.1).toColor4(1)),
        },
        this.scene,
      )
      this.sunPathMesh.isPickable = false

      for (const mark of hourMarks) {
        const lbl = createWorldLabel(
          this.scene,
          `sunHour-${mark.hour}`,
          String(mark.hour),
          HOUR_LABEL,
        )
        lbl.position = sunPoint(mark.sun.dir, radiusM * 1.02, origin)
        this.sunPathLabels.push(lbl)
      }

      const rise = createWorldLabel(
        this.scene,
        'sunriseLabel',
        daylight.sunriseLabel,
        SUNRISE_LABEL,
      )
      rise.position = sunPoint(daylight.sunriseSun.dir, radiusM * 1.05, origin)
      this.sunPathLabels.push(rise)

      const set = createWorldLabel(
        this.scene,
        'sunsetLabel',
        daylight.sunsetLabel,
        SUNRISE_LABEL,
      )
      set.position = sunPoint(daylight.sunsetSun.dir, radiusM * 1.05, origin)
      this.sunPathLabels.push(set)
    }
  }

  private clearContent(): void {
    this.sunPathMesh?.dispose()
    this.sunPathMesh = null
    for (const lbl of this.sunPathLabels) lbl.dispose()
    this.sunPathLabels = []
    this.sunMarker?.dispose()
    this.sunMarker = null
    this.sunHalo?.dispose()
    this.sunHalo = null
    this.ground?.dispose()
    this.ground = null
    if (this.house) {
      this.house.root.dispose(false, true)
      this.house = null
    }
    this.panelCount = 0
  }

  resize(): void {
    this.engine?.resize()
  }

  dispose(): void {
    this.disposed = true
    this.resizeCleanup?.()
    this.resizeCleanup = null
    this.clearContent()
    this.glowLayer?.dispose()
    this.glowLayer = null
    this.scene?.dispose()
    this.engine?.dispose()
    this.scene = null
    this.engine = null
    this.camera = null
    this.shadowGen = null
    this.dirLight = null
  }
}

import {
  Color3,
  Color4,
  DirectionalLight,
  DynamicTexture,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core'
import SunCalc from 'suncalc'

/** Demo lat/lon (default Mumbai) when caller omits location. */
export const DEFAULT_LAT = 19.076
export const DEFAULT_LON = 72.8777

export function dateFromDayOfYear(dayOfYear: number, year = 2024): Date {
  const d = new Date(Date.UTC(year, 0, 1))
  d.setUTCDate(dayOfYear)
  return d
}

export type SunLocation = { lat: number; lon: number }

export type SunHandles = {
  path: Mesh | null
  marker: Mesh | null
  glow: Mesh[]
  labels: Mesh[]
}

export type SunLightingTargets = {
  hemi: HemisphericLight
  skyMat: StandardMaterial | null
}

/**
 * Sun path arc + glowing sun disc. Updates directional light, hemi, sky and
 * clear color from altitude so date/time changes the scene lighting.
 */
export function applySun(
  scene: Scene,
  dirLight: DirectionalLight,
  dayOfYear: number,
  minuteOfDay: number,
  origin: Vector3,
  radiusM: number,
  lighting?: SunLightingTargets,
  location?: SunLocation,
): SunHandles {
  const lat = location?.lat ?? DEFAULT_LAT
  const lon = location?.lon ?? DEFAULT_LON
  const base = dateFromDayOfYear(dayOfYear)
  const when = new Date(base)
  when.setHours(Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0)

  const pos = SunCalc.getPosition(when, lat, lon)
  const alt = pos.altitude
  const az = pos.azimuth
  const x = Math.sin(az) * Math.cos(alt)
  const y = Math.sin(alt)
  const z = Math.cos(az) * Math.cos(alt)
  const dir = new Vector3(x, y, z).normalize()

  // Directional sun follows sky position
  dirLight.direction = dir.scale(-1)
  dirLight.position = origin.add(dir.scale(Math.max(radiusM * 1.8, 28)))

  const dayFactor = Math.max(0, Math.min(1, (alt + 0.05) / 0.9))
  if (alt > 0.02) {
    dirLight.intensity = 0.55 + dayFactor * 1.35
    dirLight.diffuse = Color3.Lerp(
      new Color3(1, 0.72, 0.45),
      new Color3(1, 0.97, 0.9),
      dayFactor,
    )
  } else {
    // Night / twilight
    dirLight.intensity = 0.08
    dirLight.diffuse = new Color3(0.35, 0.4, 0.55)
  }

  if (lighting?.hemi) {
    lighting.hemi.intensity = alt > 0.02 ? 0.35 + dayFactor * 0.45 : 0.18
    lighting.hemi.diffuse = Color3.Lerp(
      new Color3(0.55, 0.6, 0.75),
      new Color3(1, 0.98, 0.94),
      dayFactor,
    )
  }

  // Sky / clear color follow sun
  const skyDay = new Color3(0.55, 0.72, 0.92)
  const skyDusk = new Color3(0.75, 0.45, 0.35)
  const skyNight = new Color3(0.08, 0.1, 0.18)
  let skyCol: Color3
  if (alt > 0.15) skyCol = skyDay
  else if (alt > 0) skyCol = Color3.Lerp(skyDusk, skyDay, alt / 0.15)
  else skyCol = Color3.Lerp(skyNight, skyDusk, Math.max(0, (alt + 0.2) / 0.2))

  scene.clearColor = new Color4(skyCol.r, skyCol.g, skyCol.b, 1)
  if (lighting?.skyMat) {
    lighting.skyMat.emissiveColor = skyCol
  }
  scene.imageProcessingConfiguration.exposure = alt > 0.02 ? 0.95 + dayFactor * 0.25 : 0.7

  const points: Vector3[] = []
  for (let m = 0; m < 1440; m += 10) {
    const t = new Date(base)
    t.setHours(Math.floor(m / 60), m % 60, 0, 0)
    const p = SunCalc.getPosition(t, lat, lon)
    if (p.altitude <= 0.02) continue
    const dx = Math.sin(p.azimuth) * Math.cos(p.altitude)
    const dy = Math.sin(p.altitude)
    const dz = Math.cos(p.azimuth) * Math.cos(p.altitude)
    points.push(origin.add(new Vector3(dx, dy, dz).normalize().scale(radiusM)))
  }

  let path: Mesh | null = null
  if (points.length >= 2) {
    path = MeshBuilder.CreateLines(
      'sunPath',
      {
        points,
        colors: points.map(() => new Color3(1, 0.75, 0.2).toColor4(1)),
      },
      scene,
    )
    path.isPickable = false
  }

  let marker: Mesh | null = null
  const glow: Mesh[] = []
  if (alt > 0) {
    const sunPos = origin.add(dir.scale(radiusM))

    marker = MeshBuilder.CreateSphere('sunMarker', { diameter: 1.35, segments: 16 }, scene)
    marker.position = sunPos
    marker.isPickable = false
    const mat = new StandardMaterial('sunMat', scene)
    mat.emissiveColor = new Color3(1, 0.92, 0.45)
    mat.disableLighting = true
    marker.material = mat

    // Soft glow discs (billboards) — light rays look from reference
    for (const [name, size, alpha, tint] of [
      ['sunGlowOuter', 4.2, 0.22, new Color3(1, 0.85, 0.35)],
      ['sunGlowMid', 2.6, 0.35, new Color3(1, 0.9, 0.5)],
      ['sunGlowInner', 1.7, 0.55, new Color3(1, 0.95, 0.7)],
    ] as const) {
      const disc = MeshBuilder.CreateDisc(name, { radius: size / 2, tessellation: 32 }, scene)
      disc.position = sunPos
      disc.billboardMode = Mesh.BILLBOARDMODE_ALL
      disc.isPickable = false
      disc.renderingGroupId = 1
      const gm = new StandardMaterial(`${name}Mat`, scene)
      gm.emissiveColor = tint
      gm.disableLighting = true
      gm.alpha = alpha
      gm.backFaceCulling = false
      disc.material = gm
      glow.push(disc)
    }

    // Thin orbit rings around the sun
    for (const [ri, r] of [1.1, 1.55].entries()) {
      const ring = MeshBuilder.CreateTorus(
        `sunRing-${ri}`,
        { diameter: r * 2, thickness: 0.035, tessellation: 48 },
        scene,
      )
      ring.position = sunPos
      ring.billboardMode = Mesh.BILLBOARDMODE_ALL
      ring.isPickable = false
      const rm = new StandardMaterial(`sunRingMat-${ri}`, scene)
      rm.emissiveColor = new Color3(1, 0.88, 0.4)
      rm.disableLighting = true
      rm.alpha = 0.45
      ring.material = rm
      glow.push(ring)
    }
  }

  const labels: Mesh[] = []
  for (let h = 6; h <= 18; h++) {
    const t = new Date(base)
    t.setHours(h, 0, 0, 0)
    const p = SunCalc.getPosition(t, lat, lon)
    if (p.altitude <= 0.05) continue
    const dx = Math.sin(p.azimuth) * Math.cos(p.altitude)
    const dy = Math.sin(p.altitude)
    const dz = Math.cos(p.azimuth) * Math.cos(p.altitude)
    const plane = MeshBuilder.CreatePlane(`sunH-${h}`, { size: 0.6 }, scene)
    plane.position = origin.add(
      new Vector3(dx, dy, dz).normalize().scale(radiusM * 1.06),
    )
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL
    plane.isPickable = false
    const dt = new DynamicTexture(
      `sunHT-${h}`,
      { width: 64, height: 64 },
      scene,
      false,
    )
    const ctx = dt.getContext() as CanvasRenderingContext2D
    ctx.clearRect(0, 0, 64, 64)
    ctx.fillStyle = '#fbbf24'
    ctx.font = 'bold 36px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(h), 32, 32)
    dt.update()
    const lm = new StandardMaterial(`sunHM-${h}`, scene)
    lm.diffuseTexture = dt
    lm.emissiveTexture = dt
    lm.opacityTexture = dt
    lm.backFaceCulling = false
    lm.disableLighting = true
    plane.material = lm
    labels.push(plane)
  }

  return { path, marker, glow, labels }
}

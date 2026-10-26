import {
  Color3,
  CubeTexture,
  DynamicTexture,
  PBRMaterial,
  Scene,
  StandardMaterial,
  Texture,
} from '@babylonjs/core'

const TEX = '/textures'

/** Hex → linear-ish Color3 for PBR albedo. */
function hex(h: string): Color3 {
  const n = h.replace('#', '')
  const r = parseInt(n.slice(0, 2), 16) / 255
  const g = parseInt(n.slice(2, 4), 16) / 255
  const b = parseInt(n.slice(4, 6), 16) / 255
  return new Color3(r, g, b)
}

export type RoofMaterials = {
  /** Standard wall — always visible under hemi/dir lights (PBR looked black without IBL). */
  wall: StandardMaterial
  roofFlat: StandardMaterial
  roofTile: StandardMaterial
  concrete: StandardMaterial
  plinth: StandardMaterial
  glass: StandardMaterial
  grass: PBRMaterial
  bark: PBRMaterial
  leaf: PBRMaterial
  leafAlt: PBRMaterial
  leafAlt2: PBRMaterial
  door: StandardMaterial
  tank: StandardMaterial
  driveway: PBRMaterial
  boundary: PBRMaterial
  /** Dark PV cell face with procedural grid (standard crystalline) */
  panel: StandardMaterial
  /** Premium mono — near-black cells */
  panelPremium: StandardMaterial
  /** Thin-film — uniform purple/teal, no cell grid */
  panelThinFilm: StandardMaterial
  /** Aluminum frame around modules */
  panelFrame: StandardMaterial
  panelFramePremium: StandardMaterial
  panelFrameThinFilm: StandardMaterial
  /** Dark steel canopy pillars under the array */
  panelPillar: StandardMaterial
  /** Solar water-heater collector (blue/purple tint) */
  heaterGlass: StandardMaterial
  /** Kept for optional albedo upgrade path / sloped roof fallbacks */
  wallPbr: PBRMaterial
  roofFlatPbr: PBRMaterial
  missing: string[]
}

type PanelFaceVariant = 'standard' | 'premium' | 'thin-film'

/** Procedural PV face texture by module type. */
function makePanelCellTexture(
  scene: Scene,
  variant: PanelFaceVariant,
): DynamicTexture {
  const size = 256
  const tex = new DynamicTexture(
    `panelCellTex-${variant}`,
    { width: size, height: size },
    scene,
    false,
  )
  const ctx = tex.getContext() as CanvasRenderingContext2D

  if (variant === 'thin-film') {
    // Amorphous thin-film: smooth purple-teal, no crystalline grid
    const g = ctx.createLinearGradient(0, 0, size, size)
    g.addColorStop(0, '#1A3A4A')
    g.addColorStop(0.4, '#2A4A5C')
    g.addColorStop(0.7, '#1E3550')
    g.addColorStop(1, '#142838')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = 'rgba(80, 160, 180, 0.08)'
    for (let i = 0; i < 12; i++) {
      ctx.fillRect(0, i * (size / 12), size, 2)
    }
    tex.update()
    tex.wrapU = Texture.CLAMP_ADDRESSMODE
    tex.wrapV = Texture.CLAMP_ADDRESSMODE
    return tex
  }

  const premium = variant === 'premium'
  ctx.fillStyle = premium ? '#05080F' : '#0B1F3A'
  ctx.fillRect(0, 0, size, size)

  const cols = premium ? 8 : 6
  const rows = premium ? 12 : 10
  const pad = 6
  const gap = premium ? 1.5 : 2
  const cellW = (size - pad * 2 - gap * (cols - 1)) / cols
  const cellH = (size - pad * 2 - gap * (rows - 1)) / rows

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = pad + c * (cellW + gap)
      const y = pad + r * (cellH + gap)
      const g = ctx.createLinearGradient(x, y, x + cellW, y + cellH)
      if (premium) {
        g.addColorStop(0, '#0A1220')
        g.addColorStop(0.45, '#060B14')
        g.addColorStop(1, '#03060C')
      } else {
        g.addColorStop(0, '#163A66')
        g.addColorStop(0.45, '#0E2748')
        g.addColorStop(1, '#0A1A32')
      }
      ctx.fillStyle = g
      ctx.fillRect(x, y, cellW, cellH)

      ctx.strokeStyle = premium
        ? 'rgba(160,175,190,0.18)'
        : 'rgba(180,200,220,0.22)'
      ctx.lineWidth = 0.6
      for (let i = 1; i < 4; i++) {
        const fx = x + (cellW * i) / 4
        ctx.beginPath()
        ctx.moveTo(fx, y + 1)
        ctx.lineTo(fx, y + cellH - 1)
        ctx.stroke()
      }
    }
  }

  ctx.fillStyle = premium
    ? 'rgba(180, 190, 200, 0.4)'
    : 'rgba(200, 210, 220, 0.55)'
  for (let r = 0; r <= rows; r++) {
    const y = pad + r * (cellH + gap) - gap / 2
    ctx.fillRect(pad, y - 1, size - pad * 2, premium ? 1.6 : 2.2)
  }

  tex.update()
  tex.wrapU = Texture.CLAMP_ADDRESSMODE
  tex.wrapV = Texture.CLAMP_ADDRESSMODE
  return tex
}

function makePanelFaceMat(
  scene: Scene,
  name: string,
  variant: PanelFaceVariant,
  emissive: Color3,
): StandardMaterial {
  const mat = new StandardMaterial(name, scene)
  const cellTex = makePanelCellTexture(scene, variant)
  mat.diffuseTexture = cellTex
  mat.diffuseColor = new Color3(1, 1, 1)
  mat.emissiveTexture = cellTex
  mat.emissiveColor = emissive
  mat.specularColor =
    variant === 'thin-film'
      ? new Color3(0.55, 0.6, 0.65)
      : new Color3(0.45, 0.5, 0.55)
  mat.specularPower = variant === 'premium' ? 80 : 64
  return mat
}

/** Terracotta roof-tile rows (reference gable look). */
function makeRoofTileTexture(scene: Scene): DynamicTexture {
  const size = 256
  const tex = new DynamicTexture('roofTileTex', { width: size, height: size }, scene, false)
  const ctx = tex.getContext() as CanvasRenderingContext2D
  ctx.fillStyle = '#C45A2A'
  ctx.fillRect(0, 0, size, size)
  const rows = 10
  const cols = 8
  const th = size / rows
  const tw = size / cols
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ox = (r % 2) * (tw * 0.5)
      const x = c * tw + ox
      const y = r * th
      const shade = 160 + ((c * 17 + r * 11) % 40)
      ctx.fillStyle = `rgb(${shade + 40},${Math.floor(shade * 0.45)},${Math.floor(shade * 0.22)})`
      ctx.beginPath()
      ctx.ellipse(x + tw * 0.5, y + th * 0.55, tw * 0.42, th * 0.38, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(80,30,15,0.35)'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }
  tex.update()
  tex.wrapU = Texture.WRAP_ADDRESSMODE
  tex.wrapV = Texture.WRAP_ADDRESSMODE
  tex.uScale = 6
  tex.vScale = 6
  return tex
}

/** Soft procedural noise for bump/roughness (~1 repeat per 2 m when uScale set by caller). */
function makeNoiseTexture(scene: Scene, name: string, size = 128): DynamicTexture {
  const tex = new DynamicTexture(name, { width: size, height: size }, scene, false)
  const ctx = tex.getContext() as CanvasRenderingContext2D
  const img = ctx.createImageData(size, size)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 110 + Math.floor(Math.random() * 50)
    img.data[i] = n
    img.data[i + 1] = n
    img.data[i + 2] = n
    img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  tex.update()
  tex.wrapU = Texture.WRAP_ADDRESSMODE
  tex.wrapV = Texture.WRAP_ADDRESSMODE
  return tex
}

function solidPbr(
  scene: Scene,
  name: string,
  albedo: Color3,
  roughness: number,
  metallic = 0,
  noise: DynamicTexture | null,
  uvRepeats = 4,
): PBRMaterial {
  const m = new PBRMaterial(name, scene)
  m.albedoColor = albedo
  m.metallic = metallic
  m.roughness = roughness
  m.environmentIntensity = 0.9
  if (noise) {
    // uvRepeats ≈ meters/2 for ~1 repeat per 2 m on unit-UV faces
    const n = noise.clone()
    n.name = `${name}-noise`
    n.uScale = uvRepeats
    n.vScale = uvRepeats
    m.bumpTexture = n
    m.bumpTexture.level = 0.28
  }
  return m
}

/** Opaque StandardMaterial — reliable with Hemispheric + Directional (no IBL needed). */
function solidStd(
  scene: Scene,
  name: string,
  diffuse: Color3,
  emissiveScale = 0.2,
): StandardMaterial {
  const m = new StandardMaterial(name, scene)
  m.diffuseColor = diffuse
  m.specularColor = new Color3(0.18, 0.17, 0.15)
  m.emissiveColor = diffuse.scale(emissiveScale)
  m.ambientColor = diffuse.scale(0.35)
  return m
}

/**
 * House massing uses StandardMaterial so walls stay visible on aerial ground.
 * Optional file albedos still upgrade PBR extras (grass/panel) when present.
 */
export function createRoofMaterials(scene: Scene): RoofMaterials {
  const noiseWall = makeNoiseTexture(scene, 'noiseWall')
  const noiseGround = makeNoiseTexture(scene, 'noiseGround')
  const noiseRoof = makeNoiseTexture(scene, 'noiseRoof')

  const grass = solidPbr(scene, 'grassPbr', hex('#5E8C3A'), 0.95, 0, noiseGround, 30)

  // Warm plaster walls / membrane + terracotta tile roof
  const wall = solidStd(scene, 'wallStd', hex('#F2EBE0'), 0.28)
  const roofFlat = solidStd(scene, 'roofFlatStd', hex('#A8A49E'), 0.22)
  const roofTile = new StandardMaterial('roofTileStd', scene)
  const tileTex = makeRoofTileTexture(scene)
  roofTile.diffuseTexture = tileTex
  roofTile.emissiveTexture = tileTex
  roofTile.emissiveColor = new Color3(0.22, 0.12, 0.06)
  roofTile.specularColor = new Color3(0.2, 0.15, 0.1)
  roofTile.diffuseColor = new Color3(1, 1, 1)
  const plinth = solidStd(scene, 'plinthStd', hex('#5C5852'), 0.12)
  const concrete = solidStd(scene, 'concreteStd', hex('#8E8A84'), 0.16)
  const door = solidStd(scene, 'doorStd', hex('#5C3D28'), 0.12)
  // Black Sintex-style water tank
  const tank = solidStd(scene, 'tankStd', hex('#1A1A1A'), 0.08)
  tank.specularColor = new Color3(0.25, 0.25, 0.25)

  const glass = new StandardMaterial('glassStd', scene)
  glass.diffuseColor = hex('#A9C8DA')
  glass.emissiveColor = hex('#A9C8DA').scale(0.25)
  glass.alpha = 0.55
  glass.specularColor = new Color3(0.6, 0.65, 0.7)

  // PBR kept for optional texture upgrades + panels
  const wallPbr = solidPbr(scene, 'wallPbr', hex('#EDE4D4'), 0.88, 0, noiseWall, 4)
  wallPbr.emissiveColor = hex('#EDE4D4').scale(0.28)
  const roofFlatPbr = solidPbr(scene, 'roofFlatPbr', hex('#A8A49E'), 0.85, 0, noiseRoof, 5)
  roofFlatPbr.emissiveColor = new Color3(0.16, 0.15, 0.14)

  const driveway = solidPbr(scene, 'drivewayPbr', hex('#8B8680'), 0.9, 0, noiseGround, 12)
  const boundary = solidPbr(scene, 'boundaryPbr', hex('#D4C4A8'), 0.88, 0, noiseWall, 3)
  const bark = solidPbr(scene, 'barkPbr', hex('#5A4630'), 0.95, 0, noiseWall, 2)
  const leaf = solidPbr(scene, 'leafPbr', hex('#3F7D3A'), 0.9, 0, null)
  const leafAlt = solidPbr(scene, 'leafAltPbr', hex('#4A8F42'), 0.9, 0, null)
  const leafAlt2 = solidPbr(scene, 'leafAlt2Pbr', hex('#356B32'), 0.92, 0, null)

  const panel = makePanelFaceMat(
    scene,
    'panelStd',
    'standard',
    new Color3(0.35, 0.38, 0.42),
  )
  const panelPremium = makePanelFaceMat(
    scene,
    'panelPremium',
    'premium',
    new Color3(0.22, 0.24, 0.28),
  )
  const panelThinFilm = makePanelFaceMat(
    scene,
    'panelThinFilm',
    'thin-film',
    new Color3(0.3, 0.4, 0.45),
  )

  const panelFrame = solidStd(scene, 'panelFrameStd', hex('#C5CBD3'), 0.12)
  panelFrame.specularColor = new Color3(0.55, 0.55, 0.58)
  panelFrame.specularPower = 48

  const panelFramePremium = solidStd(
    scene,
    'panelFramePremium',
    hex('#8A9098'),
    0.1,
  )
  panelFramePremium.specularColor = new Color3(0.65, 0.62, 0.55)
  panelFramePremium.specularPower = 64

  const panelFrameThinFilm = solidStd(
    scene,
    'panelFrameThinFilm',
    hex('#3D4A52'),
    0.14,
  )
  panelFrameThinFilm.specularColor = new Color3(0.4, 0.45, 0.48)

  const panelPillar = solidStd(scene, 'panelPillarStd', hex('#2A2E33'), 0.1)
  panelPillar.specularColor = new Color3(0.3, 0.32, 0.34)

  const heaterGlass = solidStd(scene, 'heaterGlassStd', hex('#3A4A8A'), 0.25)
  heaterGlass.specularColor = new Color3(0.4, 0.45, 0.55)

  return {
    wall,
    roofFlat,
    roofTile,
    concrete,
    plinth,
    glass,
    grass,
    bark,
    leaf,
    leafAlt,
    leafAlt2,
    door,
    tank,
    driveway,
    boundary,
    panel,
    panelPremium,
    panelThinFilm,
    panelFrame,
    panelFramePremium,
    panelFrameThinFilm,
    panelPillar,
    heaterGlass,
    wallPbr,
    roofFlatPbr,
    missing: [],
  }
}

/** Pick face + frame materials for a module type. */
export function panelMatsForModule(
  mats: RoofMaterials,
  moduleType: 'standard' | 'premium' | 'thin-film' | undefined,
): { face: StandardMaterial; frame: StandardMaterial } {
  switch (moduleType) {
    case 'premium':
      return { face: mats.panelPremium, frame: mats.panelFramePremium }
    case 'thin-film':
      return { face: mats.panelThinFilm, frame: mats.panelFrameThinFilm }
    default:
      return { face: mats.panel, frame: mats.panelFrame }
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const res = await fetch(path, { method: 'HEAD', cache: 'no-cache' })
    if (!res.ok) return false
    const ct = res.headers.get('content-type') ?? ''
    // Vite SPA fallback often returns text/html for missing assets
    if (ct.includes('text/html')) return false
    return true
  } catch {
    return false
  }
}

/**
 * Optionally upgrade solid materials with real albedo maps.
 * Only assigns Texture after confirming the file exists and is not HTML.
 * Logs a single console warning listing any missing paths.
 */
export async function applyOptionalAlbedoTextures(
  scene: Scene,
  mats: RoofMaterials,
): Promise<string[]> {
  const jobs: Array<{ path: string; mat: PBRMaterial; u: number; v: number }> = [
    { path: `${TEX}/wall_plaster.jpg`, mat: mats.wallPbr, u: 4, v: 3 },
    { path: `${TEX}/roof_membrane.jpg`, mat: mats.roofFlatPbr, u: 3, v: 3 },
    { path: `${TEX}/grass.jpg`, mat: mats.grass, u: 30, v: 30 },
    { path: `${TEX}/bark.jpg`, mat: mats.bark, u: 1, v: 2 },
    { path: `${TEX}/leaves.jpg`, mat: mats.leaf, u: 2, v: 2 },
  ]

  // Standard house mats: optional diffuse maps (only if file exists)
  const stdJobs: Array<{
    path: string
    mat: StandardMaterial
    u: number
    v: number
  }> = [
    { path: `${TEX}/wall_plaster.jpg`, mat: mats.wall, u: 4, v: 3 },
    { path: `${TEX}/roof_membrane.jpg`, mat: mats.roofFlat, u: 3, v: 3 },
    // roofTile keeps procedural terracotta (file would wipe tile pattern)
    { path: `${TEX}/concrete.jpg`, mat: mats.concrete, u: 2, v: 2 },
  ]

  const missing: string[] = []
  await Promise.all(
    jobs.map(async (job) => {
      const ok = await fileExists(job.path)
      if (!ok) {
        missing.push(job.path)
        return
      }
      const tex = new Texture(job.path, scene, false, true)
      tex.wrapU = Texture.WRAP_ADDRESSMODE
      tex.wrapV = Texture.WRAP_ADDRESSMODE
      tex.uScale = job.u
      tex.vScale = job.v
      job.mat.albedoTexture = tex
    }),
  )

  await Promise.all(
    stdJobs.map(async (job) => {
      const ok = await fileExists(job.path)
      if (!ok) {
        if (!missing.includes(job.path)) missing.push(job.path)
        return
      }
      const tex = new Texture(job.path, scene, false, true)
      tex.wrapU = Texture.WRAP_ADDRESSMODE
      tex.wrapV = Texture.WRAP_ADDRESSMODE
      tex.uScale = job.u
      tex.vScale = job.v
      job.mat.diffuseTexture = tex
    }),
  )

  if (missing.length > 0) {
    console.warn(
      `[Solar Roof Preview] Missing optional textures (using solid colors): ${missing.join(', ')}`,
    )
  }
  mats.missing = missing
  return missing
}

/** Soft sky cube from generated solid faces — no external files. */
export function installGeneratedEnvironment(scene: Scene): void {
  const face = (r: number, g: number, b: number): string => {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 64
    const ctx = c.getContext('2d')!
    const grd = ctx.createLinearGradient(0, 0, 0, 64)
    grd.addColorStop(0, `rgb(${Math.min(255, r + 40)},${Math.min(255, g + 40)},${Math.min(255, b + 30)})`)
    grd.addColorStop(1, `rgb(${r},${g},${b})`)
    ctx.fillStyle = grd
    ctx.fillRect(0, 0, 64, 64)
    return c.toDataURL('image/png')
  }
  // Soft blue sky cube (+X, -X, +Y, -Y, +Z, -Z)
  const urls = [
    face(150, 185, 230),
    face(145, 180, 225),
    face(200, 220, 245),
    face(90, 120, 90),
    face(155, 190, 235),
    face(150, 185, 228),
  ]
  const env = CubeTexture.CreateFromImages(urls, scene)
  scene.environmentTexture = env
  scene.environmentIntensity = 0.75
}

/** Prefer file env if present; otherwise generated soft sky cube. */
export async function setupEnvironment(scene: Scene): Promise<string[]> {
  const candidates = [`${TEX}/env.env`, `${TEX}/env.dds`]
  const missingEnv: string[] = []
  for (const path of candidates) {
    if (await fileExists(path)) {
      try {
        const env = CubeTexture.CreateFromPrefilteredData(path, scene)
        scene.environmentTexture = env
        scene.environmentIntensity = 0.85
        return []
      } catch {
        missingEnv.push(path)
      }
    } else {
      missingEnv.push(path)
    }
  }
  installGeneratedEnvironment(scene)
  return missingEnv
}

/** @deprecated use setupEnvironment + applyOptionalAlbedoTextures */
export async function probeMissingTextures(): Promise<string[]> {
  const paths = [
    `${TEX}/wall_plaster.jpg`,
    `${TEX}/roof_membrane.jpg`,
    `${TEX}/roof_tile.jpg`,
    `${TEX}/concrete.jpg`,
    `${TEX}/grass.jpg`,
    `${TEX}/bark.jpg`,
    `${TEX}/leaves.jpg`,
    `${TEX}/env.env`,
  ]
  const missing: string[] = []
  for (const p of paths) {
    if (!(await fileExists(p))) missing.push(p)
  }
  return missing
}

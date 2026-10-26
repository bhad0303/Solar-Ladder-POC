/**
 * Procedural house / panel materials (Babylon skill: Standard + PBR patterns).
 * No third-party textures — all DynamicTexture generated.
 */
import {
  Color3,
  DynamicTexture,
  PBRMaterial,
  Scene,
  StandardMaterial,
  Texture,
} from '@babylonjs/core'

function noiseFill(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  base: string,
  speck: string,
  count: number,
): void {
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = speck
    ctx.globalAlpha = 0.04 + Math.random() * 0.08
    ctx.fillRect(
      Math.random() * w,
      Math.random() * h,
      1 + Math.random() * 3,
      1 + Math.random() * 3,
    )
  }
  ctx.globalAlpha = 1
}

export function createPlasterWallMaterial(
  scene: Scene,
  name: string,
  tintHex = '#d6d1c8',
): StandardMaterial {
  const tex = new DynamicTexture(
    `${name}-tex`,
    { width: 512, height: 512 },
    scene,
    false,
  )
  const ctx = tex.getContext() as CanvasRenderingContext2D
  noiseFill(ctx, 512, 512, tintHex, '#9a958c', 4000)
  // Subtle horizontal plaster streaks
  for (let y = 0; y < 512; y += 18) {
    ctx.strokeStyle = 'rgba(0,0,0,0.03)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, y + Math.random() * 4)
    ctx.lineTo(512, y + Math.random() * 4)
    ctx.stroke()
  }
  tex.update()
  const mat = new StandardMaterial(name, scene)
  mat.diffuseTexture = tex
  mat.specularColor = new Color3(0.18, 0.18, 0.16)
  mat.specularPower = 32
  mat.emissiveColor = new Color3(0.04, 0.04, 0.035)
  return mat
}

export function createRoofMembraneMaterial(
  scene: Scene,
  name: string,
): StandardMaterial {
  const tex = new DynamicTexture(
    `${name}-tex`,
    { width: 512, height: 512 },
    scene,
    false,
  )
  const ctx = tex.getContext() as CanvasRenderingContext2D
  noiseFill(ctx, 512, 512, '#e8e4dc', '#c8c2b8', 2500)
  // Membrane seams
  ctx.strokeStyle = 'rgba(120,110,100,0.25)'
  ctx.lineWidth = 2
  for (let x = 64; x < 512; x += 64) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, 512)
    ctx.stroke()
  }
  for (let y = 64; y < 512; y += 96) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(512, y)
    ctx.stroke()
  }
  tex.update()
  const mat = new StandardMaterial(name, scene)
  mat.diffuseTexture = tex
  ;(tex as Texture).uScale = 4
  ;(tex as Texture).vScale = 3
  mat.specularColor = new Color3(0.22, 0.22, 0.2)
  mat.specularPower = 48
  mat.emissiveColor = new Color3(0.06, 0.06, 0.05)
  return mat
}

export function createConcreteMaterial(
  scene: Scene,
  name: string,
  hex = '#a09a92',
): StandardMaterial {
  const tex = new DynamicTexture(
    `${name}-tex`,
    { width: 256, height: 256 },
    scene,
    false,
  )
  const ctx = tex.getContext() as CanvasRenderingContext2D
  noiseFill(ctx, 256, 256, hex, '#6a6560', 1800)
  tex.update()
  const mat = new StandardMaterial(name, scene)
  mat.diffuseTexture = tex
  mat.specularColor = new Color3(0.12, 0.12, 0.12)
  mat.specularPower = 16
  return mat
}

export function createGlassMaterial(
  scene: Scene,
  name: string,
): StandardMaterial {
  const mat = new StandardMaterial(name, scene)
  mat.diffuseColor = new Color3(0.35, 0.55, 0.72)
  mat.specularColor = new Color3(0.95, 0.97, 1)
  mat.specularPower = 128
  mat.emissiveColor = new Color3(0.12, 0.18, 0.25)
  mat.alpha = 0.72
  mat.backFaceCulling = false
  return mat
}

export function createFrameMaterial(
  scene: Scene,
  name: string,
  hex = '#e8eaee',
): StandardMaterial {
  const mat = new StandardMaterial(name, scene)
  mat.diffuseColor = Color3.FromHexString(hex)
  mat.specularColor = new Color3(0.55, 0.55, 0.58)
  mat.specularPower = 64
  return mat
}

/** Glossy PV module — PBR + clear coat for glass-over-cells look. */
export function createPanelPbrMaterial(
  scene: Scene,
  name: string,
  cellTex: Texture,
): PBRMaterial {
  const pbr = new PBRMaterial(name, scene)
  pbr.albedoTexture = cellTex
  pbr.albedoColor = new Color3(1, 1, 1)
  pbr.metallic = 0.15
  pbr.roughness = 0.28
  pbr.emissiveTexture = cellTex
  pbr.emissiveColor = new Color3(0.18, 0.2, 0.24)
  pbr.emissiveIntensity = 0.55
  if (pbr.clearCoat) {
    pbr.clearCoat.isEnabled = true
    pbr.clearCoat.intensity = 0.65
    pbr.clearCoat.roughness = 0.08
  }
  pbr.backFaceCulling = false
  return pbr
}

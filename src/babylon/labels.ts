/**
 * Compact world-space labels (Babylon skill: DynamicTexture on small planes).
 * Sized to match Solar Ladder–style small tooltips, not giant billboards.
 */
import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
} from '@babylonjs/core'

export type LabelStyle = {
  bg: string
  fg: string
  fontPx: number
  texW: number
  texH: number
  worldW: number
  worldH: number
}

/** Tiny measurement chip — black pill, white text (SL-like). */
export const MEAS_LABEL: LabelStyle = {
  bg: 'rgba(12,14,18,0.92)',
  fg: '#ffffff',
  fontPx: 28,
  texW: 256,
  texH: 64,
  worldW: 1.15,
  worldH: 0.32,
}

/** Yellow hour numeral on sun path. */
export const HOUR_LABEL: LabelStyle = {
  bg: 'rgba(0,0,0,0)',
  fg: '#ffcc33',
  fontPx: 56,
  texW: 128,
  texH: 128,
  worldW: 1.1,
  worldH: 1.1,
}

/** Sunrise / sunset timestamp. */
export const SUNRISE_LABEL: LabelStyle = {
  bg: 'rgba(0,0,0,0)',
  fg: '#ffdd55',
  fontPx: 36,
  texW: 256,
  texH: 80,
  worldW: 2.0,
  worldH: 0.55,
}

export function createWorldLabel(
  scene: Scene,
  name: string,
  text: string,
  style: LabelStyle,
): Mesh {
  const plane = MeshBuilder.CreatePlane(
    name,
    { width: style.worldW, height: style.worldH },
    scene,
  )
  const tex = new DynamicTexture(
    `${name}-tex`,
    { width: style.texW, height: style.texH },
    scene,
    false,
  )
  tex.hasAlpha = true
  const ctx = tex.getContext() as CanvasRenderingContext2D
  ctx.clearRect(0, 0, style.texW, style.texH)
  if (style.bg !== 'rgba(0,0,0,0)') {
    const r = Math.min(style.texH / 2, 18)
    roundRect(ctx, 2, 2, style.texW - 4, style.texH - 4, r)
    ctx.fillStyle = style.bg
    ctx.fill()
  }
  ctx.font = `bold ${style.fontPx}px sans-serif`
  ctx.fillStyle = style.fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // Soft outline for readability on sky/photo
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'
  ctx.lineWidth = Math.max(3, style.fontPx / 12)
  ctx.strokeText(text, style.texW / 2, style.texH / 2)
  ctx.fillText(text, style.texW / 2, style.texH / 2)
  tex.update()

  const mat = new StandardMaterial(`${name}-mat`, scene)
  mat.diffuseTexture = tex
  mat.emissiveTexture = tex
  mat.opacityTexture = tex
  mat.emissiveColor = new Color3(1, 1, 1)
  mat.backFaceCulling = false
  mat.disableLighting = true
  plane.material = mat
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL
  plane.isPickable = false
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

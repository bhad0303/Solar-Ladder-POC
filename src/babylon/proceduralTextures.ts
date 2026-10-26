import {
  Color3,
  DynamicTexture,
  Scene,
  StandardMaterial,
  Texture,
} from '@babylonjs/core'

/**
 * High-detail procedural mono solar panel texture (original — not a third-party asset).
 * Looks like a real framed module: glass cells, busbars, silver frame.
 */
export function createPanelCellTexture(
  scene: Scene,
  name: string,
): DynamicTexture {
  const W = 512
  const H = 1024
  const tex = new DynamicTexture(`${name}-tex`, { width: W, height: H }, scene, false)
  const ctx = tex.getContext() as CanvasRenderingContext2D

  // Outer aluminum frame
  ctx.fillStyle = '#d0d4da'
  ctx.fillRect(0, 0, W, H)
  // Inner dark bezel
  ctx.fillStyle = '#1a1c20'
  ctx.fillRect(18, 18, W - 36, H - 36)
  // Glass / cell field base
  const glass = ctx.createLinearGradient(0, 20, W, H)
  glass.addColorStop(0, '#0c2748')
  glass.addColorStop(0.45, '#123a6e')
  glass.addColorStop(1, '#0a1f3d')
  ctx.fillStyle = glass
  ctx.fillRect(28, 28, W - 56, H - 56)

  const cols = 6
  const rows = 12
  const padX = 36
  const padY = 36
  const gap = 4
  const cellW = (W - padX * 2 - gap * (cols - 1)) / cols
  const cellH = (H - padY * 2 - gap * (rows - 1)) / rows

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = padX + c * (cellW + gap)
      const y = padY + r * (cellH + gap)
      // Silicon cell body
      const cg = ctx.createLinearGradient(x, y, x + cellW, y + cellH)
      cg.addColorStop(0, '#1e5cb0')
      cg.addColorStop(0.35, '#154a90')
      cg.addColorStop(0.7, '#0f3870')
      cg.addColorStop(1, '#0c2d5a')
      ctx.fillStyle = cg
      ctx.fillRect(x, y, cellW, cellH)

      // Fine grid (finger lines)
      ctx.strokeStyle = 'rgba(200,220,255,0.22)'
      ctx.lineWidth = 1
      for (let fx = 1; fx < 4; fx++) {
        const lx = x + (cellW * fx) / 4
        ctx.beginPath()
        ctx.moveTo(lx, y + 2)
        ctx.lineTo(lx, y + cellH - 2)
        ctx.stroke()
      }
      for (let fy = 1; fy < 3; fy++) {
        const ly = y + (cellH * fy) / 3
        ctx.beginPath()
        ctx.moveTo(x + 2, ly)
        ctx.lineTo(x + cellW - 2, ly)
        ctx.stroke()
      }

      // Main busbar
      ctx.fillStyle = 'rgba(210,220,235,0.55)'
      ctx.fillRect(x + cellW * 0.42, y + 2, cellW * 0.16, cellH - 4)

      // Specular glint
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.fillRect(x + 2, y + 2, cellW * 0.35, cellH * 0.25)
    }
  }

  // Frame highlight edge
  ctx.strokeStyle = '#e8eaee'
  ctx.lineWidth = 10
  ctx.strokeRect(8, 8, W - 16, H - 16)
  ctx.strokeStyle = '#8a9098'
  ctx.lineWidth = 3
  ctx.strokeRect(22, 22, W - 44, H - 44)

  // Corner screws
  for (const [sx, sy] of [
    [14, 14],
    [W - 14, 14],
    [14, H - 14],
    [W - 14, H - 14],
  ] as const) {
    ctx.fillStyle = '#6a7078'
    ctx.beginPath()
    ctx.arc(sx, sy, 5, 0, Math.PI * 2)
    ctx.fill()
  }

  tex.update()
  return tex
}

/** Original mono-cell solar panel grid (not copied from third-party assets). */
export function createPanelCellMaterial(
  scene: Scene,
  name: string,
): StandardMaterial {
  const tex = createPanelCellTexture(scene, name)
  const mat = new StandardMaterial(name, scene)
  mat.diffuseTexture = tex
  mat.emissiveTexture = tex
  mat.emissiveColor = new Color3(0.35, 0.38, 0.42)
  mat.specularColor = new Color3(0.55, 0.58, 0.62)
  mat.specularPower = 96
  mat.backFaceCulling = false
  return mat
}

/** Faceted canopy leaf fill — procedural, not a third-party texture. */
export function createLeafCanopyMaterial(
  scene: Scene,
  name: string,
): StandardMaterial {
  const tex = new DynamicTexture(
    `${name}-tex`,
    { width: 256, height: 256 },
    scene,
    false,
  )
  const ctx = tex.getContext() as CanvasRenderingContext2D
  ctx.fillStyle = '#2a6b28'
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 256
    const y = Math.random() * 256
    const r = 6 + Math.random() * 14
    ctx.fillStyle =
      i % 3 === 0
        ? 'rgba(60,140,55,0.85)'
        : i % 3 === 1
          ? 'rgba(40,110,40,0.9)'
          : 'rgba(80,160,70,0.75)'
    ctx.beginPath()
    ctx.ellipse(x, y, r, r * 0.55, Math.random() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }
  tex.update()
  const mat = new StandardMaterial(name, scene)
  mat.diffuseTexture = tex
  ;(tex as Texture).uScale = 2
  ;(tex as Texture).vScale = 2
  mat.emissiveTexture = tex
  mat.emissiveColor = new Color3(0.15, 0.22, 0.12)
  mat.specularColor = new Color3(0.08, 0.1, 0.06)
  return mat
}

export function createBarkMaterial(
  scene: Scene,
  name: string,
): StandardMaterial {
  const tex = new DynamicTexture(
    `${name}-tex`,
    { width: 128, height: 256 },
    scene,
    false,
  )
  const ctx = tex.getContext() as CanvasRenderingContext2D
  ctx.fillStyle = '#5a3d24'
  ctx.fillRect(0, 0, 128, 256)
  for (let x = 8; x < 128; x += 14) {
    ctx.strokeStyle = `rgba(40,25,12,${0.3 + Math.random() * 0.4})`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + (Math.random() - 0.5) * 6, 256)
    ctx.stroke()
  }
  tex.update()
  const mat = new StandardMaterial(name, scene)
  mat.diffuseTexture = tex
  mat.specularColor = new Color3(0.05, 0.05, 0.04)
  return mat
}

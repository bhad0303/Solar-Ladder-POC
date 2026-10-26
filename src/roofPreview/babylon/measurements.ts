import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import {
  mToDisplay,
  type FootprintPoint,
  type LengthUnit,
} from '../types'

export function buildMeasurements(
  scene: Scene,
  parent: TransformNode,
  footprint: FootprintPoint[],
  roofY: number,
  unit: LengthUnit = 'm',
): Mesh[] {
  const out: Mesh[] = []
  const y = roofY + 0.4
  const suffix = unit === 'ft' ? 'ft' : 'm'
  for (let i = 0; i < footprint.length; i++) {
    const a = footprint[i]!
    const b = footprint[(i + 1) % footprint.length]!
    const distM = Math.hypot(b.x - a.x, b.z - a.z)
    const dist = mToDisplay(distM, unit)
    const text = `${dist.toFixed(1)} ${suffix}`

    const line = MeshBuilder.CreateLines(
      `meas-${i}`,
      {
        points: [
          new Vector3(a.x, y, a.z),
          new Vector3(b.x, y, b.z),
        ],
        colors: [
          new Color3(0.2, 0.85, 1).toColor4(1),
          new Color3(0.2, 0.85, 1).toColor4(1),
        ],
      },
      scene,
    )
    line.parent = parent
    out.push(line)

    const mid = new Vector3((a.x + b.x) / 2, y + 0.35, (a.z + b.z) / 2)
    // Wider plane so "45.9 ft" stays readable
    const plane = MeshBuilder.CreatePlane(`measL-${i}`, { width: 1.6, height: 0.55 }, scene)
    plane.position = mid
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL
    plane.parent = parent
    const dt = new DynamicTexture(
      `measT-${i}`,
      { width: 256, height: 96 },
      scene,
      false,
    )
    const ctx = dt.getContext() as CanvasRenderingContext2D
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, 256, 96)
    ctx.fillStyle = '#f8fafc'
    ctx.font = 'bold 36px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 128, 48)
    dt.update()
    const mat = new StandardMaterial(`measM-${i}`, scene)
    mat.diffuseTexture = dt
    mat.emissiveTexture = dt
    mat.disableLighting = true
    mat.backFaceCulling = false
    plane.material = mat
    out.push(plane)
  }
  return out
}

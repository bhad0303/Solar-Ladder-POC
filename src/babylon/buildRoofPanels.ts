import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  TransformNode,
} from '@babylonjs/core'
import type { RoofPanelSpec } from '../panels/layoutPanels'
import { createFrameMaterial, createPanelPbrMaterial } from './houseMaterials'
import { createPanelCellTexture } from './proceduralTextures'

const PANEL_VISUAL_SCALE = 1.05

export function buildRoofPanels(
  scene: Scene,
  parent: TransformNode,
  shadowGen: ShadowGenerator,
  panels: RoofPanelSpec[],
): Map<string, Mesh> {
  const meshes = new Map<string, Mesh>()
  if (panels.length === 0) return meshes

  const cellTex = createPanelCellTexture(scene, 'roofPanelCell')
  const panelMat = createPanelPbrMaterial(scene, 'roofPanelPbr', cellTex)
  const frameMat = createFrameMaterial(scene, 'roofPanelFrame', '#c8ccd4')
  const legMat = new StandardMaterial('roofPanelLeg', scene)
  legMat.diffuseColor = new Color3(0.4, 0.42, 0.45)
  legMat.specularColor = new Color3(0.35, 0.35, 0.38)

  for (const panel of panels) {
    const pw = panel.widthM * PANEL_VISUAL_SCALE
    const ph = panel.heightM * PANEL_VISUAL_SCALE
    const group = new TransformNode(`panelGroup-${panel.id}`, scene)
    group.parent = parent
    group.position.set(panel.x, panel.y, panel.z)
    group.rotation.y = (panel.azimuthDeg * Math.PI) / 180
    group.rotation.x = (-panel.tiltDeg * Math.PI) / 180

    const frame = MeshBuilder.CreateBox(
      `frame-${panel.id}`,
      { width: pw + 0.05, height: 0.045, depth: ph + 0.05 },
      scene,
    )
    frame.parent = group
    frame.material = frameMat
    frame.receiveShadows = true
    shadowGen.addShadowCaster(frame)

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
    meshes.set(panel.id, face)

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
      leg.position.set(lx, -legH / 2 - 0.01, lz)
      leg.parent = group
      leg.material = legMat
      shadowGen.addShadowCaster(leg)
    }
  }

  return meshes
}

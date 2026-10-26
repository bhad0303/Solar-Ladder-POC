import {
  Color3,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Texture,
} from '@babylonjs/core'

/** Aerial plan meters — matches crop of welcome-4KG9VicLWQY-unsplash.jpg */
export const AERIAL_GROUND_METERS = 34

const AERIAL_URL = '/assets/site-aerial-plan.jpg'

/**
 * Satellite / aerial ground from the Unsplash coastal photo, centered on the
 * red-roof house. Falls back to solid grass if the file is missing (never
 * assigns a broken texture → no red/black checkerboard).
 */
export async function createAerialGround(
  scene: Scene,
  grassFallback: PBRMaterial,
  shadowGen: ShadowGenerator | null,
): Promise<Mesh> {
  const ground = MeshBuilder.CreateGround(
    'aerialPlan',
    {
      width: AERIAL_GROUND_METERS,
      height: AERIAL_GROUND_METERS,
      subdivisions: 1,
    },
    scene,
  )
  ground.position.y = -0.03
  ground.receiveShadows = true
  ground.isPickable = false

  let ok = false
  try {
    const res = await fetch(AERIAL_URL, { method: 'HEAD', cache: 'no-cache' })
    const ct = res.headers.get('content-type') ?? ''
    ok = res.ok && !ct.includes('text/html')
  } catch {
    ok = false
  }

  if (ok) {
    const mat = new StandardMaterial('aerialPlanMat', scene)
    const tex = new Texture(AERIAL_URL, scene, false, true)
    tex.wrapU = Texture.CLAMP_ADDRESSMODE
    tex.wrapV = Texture.CLAMP_ADDRESSMODE
    mat.diffuseTexture = tex
    mat.specularColor = new Color3(0.05, 0.05, 0.05)
    // Keep photo readable under PBR lighting
    mat.emissiveColor = new Color3(0.12, 0.12, 0.12)
    mat.emissiveTexture = tex
    ground.material = mat
  } else {
    console.warn(
      `[Solar Roof Preview] Aerial plan missing at ${AERIAL_URL}; using grass.`,
    )
    ground.material = grassFallback
  }

  void shadowGen
  return ground
}

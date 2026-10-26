import type { Scene } from '@babylonjs/core'

/** Dispose all meshes/materials under a scene (helper for tests / cleanup). */
export function disposeSceneContent(scene: Scene): void {
  for (const mesh of [...scene.meshes]) {
    mesh.dispose(false, true)
  }
}

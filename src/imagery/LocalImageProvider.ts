import type { ImageryBlock } from '../data/types'
import type { ImageryProbeResult, ImageryProvider } from './types'

/**
 * Serves a single local satellite JPG from /public (no network tiles).
 * Default path: public/assets/site-satellite.jpg → /assets/site-satellite.jpg
 */
export class LocalImageProvider implements ImageryProvider {
  readonly id = 'local-image'

  resolveUrl(imagery: ImageryBlock): string {
    const file = imagery.file.startsWith('/')
      ? imagery.file
      : `/${imagery.file}`
    return file
  }

  async probe(imagery: ImageryBlock): Promise<ImageryProbeResult> {
    const url = this.resolveUrl(imagery)
    try {
      const res = await fetch(url, { method: 'HEAD', cache: 'no-cache' })
      if (res.ok) return { ok: true, url }
      // Some static servers reject HEAD — try GET range
      const get = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        cache: 'no-cache',
      })
      if (get.ok || get.status === 206) return { ok: true, url }
      return {
        ok: false,
        url,
        reason: `Missing local image (${get.status}). Place file at public/assets/site-satellite.jpg`,
      }
    } catch (err) {
      return {
        ok: false,
        url,
        reason:
          err instanceof Error
            ? err.message
            : 'Could not load local satellite image',
      }
    }
  }
}

export const localImageProvider = new LocalImageProvider()

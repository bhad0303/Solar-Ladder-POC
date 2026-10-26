import type { ImageryBlock } from '../data/types'

/** Pluggable imagery source — only LocalImageProvider is implemented in this POC. */
export interface ImageryProvider {
  readonly id: string
  /** Resolve URL / path used by Babylon Texture. */
  resolveUrl(imagery: ImageryBlock): string
  /** HEAD/GET check that the asset exists under public/. */
  probe(imagery: ImageryBlock): Promise<ImageryProbeResult>
}

export type ImageryProbeResult =
  | { ok: true; url: string }
  | { ok: false; url: string; reason: string }

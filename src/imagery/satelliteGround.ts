import type { LatLng } from '../types/project'
import { metersPerDegreeLat, metersPerDegreeLng } from '../geo/localFrame'

export type SatelliteGroundSpec = {
  url: string
  widthM: number
  heightM: number
  center: LatLng
  source: 'esri'
}

/** Half-size of ground patch around the pin (meters). */
export const GROUND_HALF_M = 40

/** Blob URL cache so Rebuild / second Find doesn't re-download. */
const blobCache = new Map<string, string>()

function cacheKey(center: LatLng, halfM: number): string {
  return `${center.lat.toFixed(5)},${center.lng.toFixed(5)},${halfM}`
}

export function buildSatelliteGroundSpec(
  center: LatLng,
  halfM = GROUND_HALF_M,
): SatelliteGroundSpec {
  const dLat = halfM / metersPerDegreeLat()
  const dLng = halfM / metersPerDegreeLng(center.lat)
  const south = center.lat - dLat
  const north = center.lat + dLat
  const west = center.lng - dLng
  const east = center.lng + dLng

  // 640px is enough for POC and much faster than 1024
  const esri =
    `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export` +
    `?bbox=${west},${south},${east},${north}` +
    `&bboxSR=4326&imageSR=4326&size=640,640&format=jpg&f=image`

  return {
    url: esri,
    widthM: halfM * 2,
    heightM: halfM * 2,
    center,
    source: 'esri',
  }
}

/**
 * Prefetch satellite as blob URL (parallel with / after Find house).
 * Returns cached blob: URL for Babylon Texture (same-origin-ish, no CORS wait).
 */
export async function prefetchSatelliteBlob(
  center: LatLng,
  halfM = GROUND_HALF_M,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const key = cacheKey(center, halfM)
  const hit = blobCache.get(key)
  if (hit) return hit

  const spec = buildSatelliteGroundSpec(center, halfM)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 12_000)
  try {
    const res = await fetchImpl(spec.url, {
      mode: 'cors',
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`satellite HTTP ${res.status}`)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    blobCache.set(key, objectUrl)
    return objectUrl
  } finally {
    clearTimeout(timer)
  }
}

/** Prefer cached blob URL; fall back to remote Esri URL. */
export async function resolveSatelliteTextureUrl(
  center: LatLng,
  halfM = GROUND_HALF_M,
): Promise<{ url: string; widthM: number; heightM: number }> {
  const spec = buildSatelliteGroundSpec(center, halfM)
  try {
    const blobUrl = await prefetchSatelliteBlob(center, halfM)
    return { url: blobUrl, widthM: spec.widthM, heightM: spec.heightM }
  } catch {
    return { url: spec.url, widthM: spec.widthM, heightM: spec.heightM }
  }
}

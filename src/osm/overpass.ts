import type { LatLng } from '../types/project'
import { fetchBuildingsViaOsmMapApi } from './osmMapApi'

/**
 * Free Overpass mirrors (backup). Tried one-by-one — no parallel abort storm.
 * Primary path is OSM Map API (see fetchBuildingsNear).
 */
const ENDPOINTS = [
  'https://overpass.nchc.org.tw/api/interpreter', // Asia — often better for IN
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
]

export type OverpassWay = {
  type: 'way'
  id: number
  tags?: Record<string, string>
  geometry?: Array<{ lat: number; lon: number }>
}

type OverpassResponse = {
  elements?: OverpassWay[]
}

export const OVERPASS_RADIUS_M = 30

/** Per-mirror timeout (sequential). */
export const OVERPASS_FETCH_MS = 18_000

const wayCache = new Map<string, OverpassWay[]>()

export function cacheKey(point: LatLng): string {
  return `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`
}

export function clearOverpassCache(): void {
  wayCache.clear()
}

export function buildIsInQuery(lat: number, lng: number): string {
  return `
[out:json][timeout:15];
is_in(${lat},${lng})->.a;
way(pivot.a)["building"];
out geom;
`.trim()
}

export function buildAroundQuery(lat: number, lng: number, radiusM: number): string {
  return `
[out:json][timeout:15];
way["building"](around:${radiusM},${lat},${lng});
out geom;
`.trim()
}

function filterWays(elements: OverpassWay[] | undefined): OverpassWay[] {
  return (elements ?? []).filter(
    (el): el is OverpassWay =>
      el.type === 'way' &&
      Array.isArray(el.geometry) &&
      el.geometry.length >= 3,
  )
}

async function postQuery(
  url: string,
  query: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<OverpassWay[]> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: new URLSearchParams({ data: query }),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as OverpassResponse
    return filterWays(json.elements)
  } finally {
    clearTimeout(timer)
  }
}

/** Try mirrors sequentially; first OK wins (no abort-all race). */
export async function sequentialOverpassQuery(
  query: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = OVERPASS_FETCH_MS,
): Promise<OverpassWay[]> {
  const errors: string[] = []
  for (const url of ENDPOINTS) {
    try {
      return await postQuery(url, query, fetchImpl, timeoutMs)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Normalize abort noise
      const nice =
        msg.includes('aborted') || msg.includes('AbortError')
          ? `timeout ${timeoutMs}ms`
          : msg
      errors.push(`${new URL(url).host}: ${nice}`)
    }
  }
  throw new Error(`Overpass fail — ${errors.join(' | ')}`)
}

/**
 * 1) Free OSM Map API (small bbox) — preferred
 * 2) Overpass is_in → around (sequential mirrors)
 */
export async function fetchBuildingsNear(
  point: LatLng,
  radiusM = OVERPASS_RADIUS_M,
  fetchImpl: typeof fetch = fetch,
): Promise<OverpassWay[]> {
  const key = cacheKey(point)
  const hit = wayCache.get(key)
  if (hit) return hit

  const errors: string[] = []

  // Primary: official OSM map extract (via Vite proxy in dev)
  try {
    const ways = await fetchBuildingsViaOsmMapApi(point, radiusM, fetchImpl)
    wayCache.set(key, ways)
    return ways
  } catch (err) {
    errors.push(
      err instanceof Error ? `OSM Map: ${err.message}` : 'OSM Map failed',
    )
  }

  // Backup: Overpass
  try {
    let ways = await sequentialOverpassQuery(
      buildIsInQuery(point.lat, point.lng),
      fetchImpl,
    )
    if (ways.length === 0) {
      ways = await sequentialOverpassQuery(
        buildAroundQuery(point.lat, point.lng, radiusM),
        fetchImpl,
      )
    }
    wayCache.set(key, ways)
    return ways
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'Overpass failed')
    throw new Error(errors.join(' → '))
  }
}

export function wayToLatLngRing(way: OverpassWay): LatLng[] {
  return (way.geometry ?? []).map((g) => ({ lat: g.lat, lng: g.lon }))
}

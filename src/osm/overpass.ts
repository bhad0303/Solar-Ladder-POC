import type { LatLng } from '../types/project'

/** Public mirrors — raced in parallel; first OK wins. */
const ENDPOINTS = [
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
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

/** Tight radius for around: fallback (m). */
export const OVERPASS_RADIUS_M = 25

/** Per-mirror HTTP timeout — don't wait 35s on a hung server. */
export const OVERPASS_FETCH_MS = 10_000

/** In-memory footprint query cache (rounded pin). */
const wayCache = new Map<string, OverpassWay[]>()

export function cacheKey(point: LatLng): string {
  return `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`
}

export function clearOverpassCache(): void {
  wayCache.clear()
}

/** Prefer buildings that contain the pin (accurate + usually small result). */
export function buildIsInQuery(lat: number, lng: number): string {
  return `
[out:json][timeout:8];
is_in(${lat},${lng})->.a;
way(pivot.a)["building"];
out geom;
`.trim()
}

/** Nearby ways if is_in returns nothing (pin slightly off roof). */
export function buildAroundQuery(lat: number, lng: number, radiusM: number): string {
  return `
[out:json][timeout:8];
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
  signal: AbortSignal,
): Promise<OverpassWay[]> {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: new URLSearchParams({ data: query }),
    signal,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = (await res.json()) as OverpassResponse
  return filterWays(json.elements)
}

/**
 * Race all mirrors; first successful JSON wins. Others are aborted.
 */
export async function raceOverpassQuery(
  query: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = OVERPASS_FETCH_MS,
): Promise<OverpassWay[]> {
  const controllers = ENDPOINTS.map(() => new AbortController())
  const timer = setTimeout(() => {
    for (const c of controllers) c.abort()
  }, timeoutMs)

  const tasks = ENDPOINTS.map((url, i) =>
    postQuery(url, query, fetchImpl, controllers[i]!.signal).then((ways) => {
      // Abort siblings on first success
      for (let j = 0; j < controllers.length; j++) {
        if (j !== i) controllers[j]!.abort()
      }
      return ways
    }),
  )

  try {
    // Promise.any: first fulfilled; ignores rejections until all fail
    return await Promise.any(tasks)
  } catch (err) {
    const msg =
      err instanceof AggregateError
        ? err.errors.map((e) => (e instanceof Error ? e.message : String(e))).join('; ')
        : err instanceof Error
          ? err.message
          : 'Overpass failed'
    throw new Error(`Overpass timeout/fail (${timeoutMs}ms): ${msg}`)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Fast path: is_in (contains pin) → else around:25m.
 * Results cached by ~1 m pin grid.
 */
export async function fetchBuildingsNear(
  point: LatLng,
  radiusM = OVERPASS_RADIUS_M,
  fetchImpl: typeof fetch = fetch,
): Promise<OverpassWay[]> {
  const key = cacheKey(point)
  const hit = wayCache.get(key)
  if (hit) return hit

  // 1) Buildings that contain the pin (best accuracy)
  let ways = await raceOverpassQuery(
    buildIsInQuery(point.lat, point.lng),
    fetchImpl,
  )

  // 2) Fallback: nearby outlines if pin is slightly outside mapped polygon
  if (ways.length === 0) {
    ways = await raceOverpassQuery(
      buildAroundQuery(point.lat, point.lng, radiusM),
      fetchImpl,
    )
  }

  wayCache.set(key, ways)
  return ways
}

export function wayToLatLngRing(way: OverpassWay): LatLng[] {
  return (way.geometry ?? []).map((g) => ({ lat: g.lat, lng: g.lon }))
}

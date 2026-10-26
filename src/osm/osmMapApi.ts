/**
 * Free OSM Map API (api.openstreetmap.org) — small bbox around the pin.
 * No Overpass; often more reliable. Browser uses Vite proxy (/osm-api) to avoid CORS.
 */
import type { LatLng } from '../types/project'
import { metersPerDegreeLat, metersPerDegreeLng } from '../geo/localFrame'
import type { OverpassWay } from './overpass'

const OSM_MAP_TIMEOUT_MS = 15_000

/** ~meters around pin → bbox (degrees). */
export function pinToBBox(
  pin: LatLng,
  radiusM: number,
): { west: number; south: number; east: number; north: number } {
  const dLat = radiusM / metersPerDegreeLat()
  const dLng = radiusM / metersPerDegreeLng(pin.lat)
  return {
    west: pin.lng - dLng,
    south: pin.lat - dLat,
    east: pin.lng + dLng,
    north: pin.lat + dLat,
  }
}

export function buildOsmMapUrls(bbox: {
  west: number
  south: number
  east: number
  north: number
}): string[] {
  const q = `bbox=${bbox.west},${bbox.south},${bbox.east},${bbox.north}`
  // Proxy first (dev / vite); direct second (if CORS ever allowed)
  return [
    `/osm-api/api/0.6/map?${q}`,
    `https://api.openstreetmap.org/api/0.6/map?${q}`,
  ]
}

/**
 * Parse OSM XML map dump → building ways with inline geometry.
 * Works in browser (DOMParser) and Node tests (regex fallback).
 */
export function parseOsmMapXml(xmlText: string): OverpassWay[] {
  if (typeof DOMParser !== 'undefined') {
    return parseOsmMapXmlDom(xmlText)
  }
  return parseOsmMapXmlRegex(xmlText)
}

function parseOsmMapXmlDom(xmlText: string): OverpassWay[] {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  if (doc.querySelector('parsererror')) {
    throw new Error('OSM XML parse error')
  }

  const nodes = new Map<string, { lat: number; lon: number }>()
  for (const n of Array.from(doc.getElementsByTagName('node'))) {
    const id = n.getAttribute('id')
    const lat = Number(n.getAttribute('lat'))
    const lon = Number(n.getAttribute('lon'))
    if (id && Number.isFinite(lat) && Number.isFinite(lon)) {
      nodes.set(id, { lat, lon })
    }
  }

  const ways: OverpassWay[] = []
  for (const w of Array.from(doc.getElementsByTagName('way'))) {
    const tags: Record<string, string> = {}
    for (const t of Array.from(w.getElementsByTagName('tag'))) {
      const k = t.getAttribute('k')
      const v = t.getAttribute('v')
      if (k && v != null) tags[k] = v
    }
    if (!('building' in tags)) continue

    const geometry: Array<{ lat: number; lon: number }> = []
    for (const nd of Array.from(w.getElementsByTagName('nd'))) {
      const ref = nd.getAttribute('ref')
      if (!ref) continue
      const node = nodes.get(ref)
      if (node) geometry.push(node)
    }
    if (geometry.length < 3) continue

    const id = Number(w.getAttribute('id') ?? 0)
    ways.push({ type: 'way', id, tags, geometry })
  }

  return ways
}

/** Lightweight XML scrape for Vitest (no DOM). */
function parseOsmMapXmlRegex(xmlText: string): OverpassWay[] {
  const nodes = new Map<string, { lat: number; lon: number }>()
  const nodeRe =
    /<node\b[^>]*\bid="(\d+)"[^>]*\blat="([^"]+)"[^>]*\blon="([^"]+)"[^>]*\/?>/g
  let m: RegExpExecArray | null
  while ((m = nodeRe.exec(xmlText)) !== null) {
    nodes.set(m[1]!, { lat: Number(m[2]), lon: Number(m[3]) })
  }

  const ways: OverpassWay[] = []
  const wayRe = /<way\b([^>]*)>([\s\S]*?)<\/way>/g
  while ((m = wayRe.exec(xmlText)) !== null) {
    const open = m[1] ?? ''
    const body = m[2] ?? ''
    if (!/k="building"/.test(body)) continue
    const idMatch = /\bid="(\d+)"/.exec(open)
    const id = Number(idMatch?.[1] ?? 0)
    const tags: Record<string, string> = {}
    const tagRe = /<tag\b[^>]*\bk="([^"]+)"[^>]*\bv="([^"]*)"[^>]*\/?>/g
    let tm: RegExpExecArray | null
    while ((tm = tagRe.exec(body)) !== null) {
      tags[tm[1]!] = tm[2]!
    }
    const geometry: Array<{ lat: number; lon: number }> = []
    const ndRe = /<nd\b[^>]*\bref="(\d+)"[^>]*\/?>/g
    let nm: RegExpExecArray | null
    while ((nm = ndRe.exec(body)) !== null) {
      const node = nodes.get(nm[1]!)
      if (node) geometry.push(node)
    }
    if (geometry.length < 3) continue
    ways.push({ type: 'way', id, tags, geometry })
  }
  return ways
}

export async function fetchBuildingsViaOsmMapApi(
  pin: LatLng,
  radiusM: number,
  fetchImpl: typeof fetch = fetch,
): Promise<OverpassWay[]> {
  const bbox = pinToBBox(pin, radiusM)
  const urls = buildOsmMapUrls(bbox)
  let lastErr: Error | null = null

  for (const url of urls) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), OSM_MAP_TIMEOUT_MS)
    try {
      const res = await fetchImpl(url, {
        signal: ctrl.signal,
        headers: { Accept: 'application/xml, text/xml, */*' },
      })
      if (!res.ok) {
        lastErr = new Error(`OSM Map HTTP ${res.status}`)
        continue
      }
      const text = await res.text()
      return parseOsmMapXml(text)
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err))
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastErr ?? new Error('OSM Map API failed')
}

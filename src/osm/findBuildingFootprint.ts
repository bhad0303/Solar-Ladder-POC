import type { BuildingFootprint, LatLng } from '../types/project'
import {
  cleanRingLatLng,
  centroidLatLng,
  distanceToPolygonEdgeM,
  pointInPolygonLatLng,
  polygonAreaM2,
  ringToLocal,
} from './polygonMath'
import {
  fetchBuildingsNear,
  OVERPASS_RADIUS_M,
  wayToLatLngRing,
  type OverpassWay,
} from './overpass'

export type FindFootprintResult =
  | { ok: true; footprint: BuildingFootprint; areaM2: number }
  | { ok: false; reason: 'not_found' | 'overpass_error'; message: string }

/** Nearest only if pin is this close to an edge (avoids wrong neighbour). */
const MAX_NEAREST_EDGE_M = 6

function parseLevels(tags: Record<string, string> | undefined): number | null {
  if (!tags) return null
  const raw = tags['building:levels'] ?? tags.levels
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

function parseHeightM(tags: Record<string, string> | undefined): number | null {
  if (!tags?.height) return null
  const m = Number(String(tags.height).replace(/m$/i, '').trim())
  return Number.isFinite(m) && m > 0 ? m : null
}

function toFootprint(
  way: OverpassWay,
  pin: LatLng,
  selection: BuildingFootprint['selection'],
): BuildingFootprint | null {
  const ring = cleanRingLatLng(wayToLatLngRing(way))
  if (ring.length < 3) return null
  const tags = way.tags ?? {}
  const levels = parseLevels(tags)
  const heightM = parseHeightM(tags)
  const local = ringToLocal(ring, pin)

  return {
    polygonLocal: local,
    polygonLatLng: ring,
    centroid: centroidLatLng(ring),
    areaM2: polygonAreaM2(local),
    osmId: `way/${way.id}`,
    tags: {
      building: tags.building,
      levels,
      heightM,
      roofShape: tags['roof:shape'] ?? null,
    },
    selection,
    source: 'overpass',
    quality: {
      footprint: 'osm',
      height: heightM != null || levels != null ? 'osm' : 'estimated',
      roof: tags['roof:shape'] ? 'osm' : 'estimated',
    },
  }
}

export function selectBuildingWay(
  pin: LatLng,
  ways: OverpassWay[],
): { way: OverpassWay; selection: 'contains' | 'nearest' } | null {
  const candidates = ways
    .map((way) => {
      const ring = cleanRingLatLng(wayToLatLngRing(way))
      return ring.length >= 3 ? { way, ring } : null
    })
    .filter((c): c is { way: OverpassWay; ring: LatLng[] } => c != null)

  if (candidates.length === 0) return null

  const containing = candidates.filter((c) => pointInPolygonLatLng(pin, c.ring))
  if (containing.length === 1) {
    return { way: containing[0]!.way, selection: 'contains' }
  }
  if (containing.length > 1) {
    containing.sort(
      (a, b) =>
        polygonAreaM2(ringToLocal(a.ring, pin)) -
        polygonAreaM2(ringToLocal(b.ring, pin)),
    )
    return { way: containing[0]!.way, selection: 'contains' }
  }

  let best: { way: OverpassWay; dist: number } | null = null
  for (const c of candidates) {
    const dist = distanceToPolygonEdgeM(pin, c.ring)
    if (dist > MAX_NEAREST_EDGE_M) continue
    if (!best || dist < best.dist) best = { way: c.way, dist }
  }
  if (!best) return null
  return { way: best.way, selection: 'nearest' }
}

/** Free OSM Overpass only — no paid Google Solar / Maps. */
export async function findBuildingFootprint(
  pin: LatLng,
  fetchImpl?: typeof fetch,
): Promise<FindFootprintResult> {
  try {
    const ways = await fetchBuildingsNear(pin, OVERPASS_RADIUS_M, fetchImpl)
    const picked = selectBuildingWay(pin, ways)
    if (!picked) {
      return {
        ok: false,
        reason: 'not_found',
        message:
          'No building outline was found near this pin. Place the pin in the middle of the roof, or try an OSM-mapped area.',
      }
    }
    const footprint = toFootprint(picked.way, pin, picked.selection)
    if (!footprint) {
      return {
        ok: false,
        reason: 'not_found',
        message: 'OSM way geometry is incomplete.',
      }
    }
    return {
      ok: true,
      footprint,
      areaM2: polygonAreaM2(footprint.polygonLocal),
    }
  } catch (err) {
    return {
      ok: false,
      reason: 'overpass_error',
      message:
        err instanceof Error
          ? `OSM Overpass: ${err.message}`
          : 'OSM Overpass failed',
    }
  }
}

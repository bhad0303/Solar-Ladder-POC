import type { LatLng, Vec2 } from '../types/project'
import { latLngToLocal } from '../geo/localFrame'

/** Drop duplicate closing vertex if present; require ≥ 3 unique verts. */
export function cleanRingLatLng(ring: LatLng[]): LatLng[] {
  if (ring.length < 3) return []
  const out = ring.map((p) => ({ lat: p.lat, lng: p.lng }))
  const first = out[0]!
  const last = out[out.length - 1]!
  if (
    Math.abs(first.lat - last.lat) < 1e-12 &&
    Math.abs(first.lng - last.lng) < 1e-12
  ) {
    out.pop()
  }
  return out.length >= 3 ? out : []
}

export function ringToLocal(ring: LatLng[], origin: LatLng): Vec2[] {
  return ring.map((p) => latLngToLocal(p, origin))
}

/** Ray-cast point-in-polygon (lat/lng treated as planar locally). */
export function pointInPolygonLatLng(point: LatLng, ring: LatLng[]): boolean {
  const poly = cleanRingLatLng(ring)
  if (poly.length < 3) return false
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const pi = poly[i]!
    const pj = poly[j]!
    const dy = pj.lat - pi.lat
    if (Math.abs(dy) < 1e-15) continue
    const crosses =
      (pi.lat > point.lat) !== (pj.lat > point.lat) &&
      point.lng <
        ((pj.lng - pi.lng) * (point.lat - pi.lat)) / dy + pi.lng
    if (crosses) inside = !inside
  }
  return inside
}

/** Shoelace area in m² from local-meter ring (open or closed). */
export function polygonAreaM2(local: Vec2[]): number {
  if (local.length < 3) return 0
  let sum = 0
  for (let i = 0; i < local.length; i++) {
    const a = local[i]!
    const b = local[(i + 1) % local.length]!
    sum += a.x * b.z - b.x * a.z
  }
  return Math.abs(sum) * 0.5
}

export function centroidLatLng(ring: LatLng[]): LatLng {
  const poly = cleanRingLatLng(ring)
  if (poly.length === 0) return { lat: 0, lng: 0 }
  let lat = 0
  let lng = 0
  for (const p of poly) {
    lat += p.lat
    lng += p.lng
  }
  return { lat: lat / poly.length, lng: lng / poly.length }
}

/** Approx distance (m) from point to polygon centroid. */
export function distanceToCentroidM(point: LatLng, ring: LatLng[]): number {
  const c = centroidLatLng(ring)
  const local = latLngToLocal(point, c)
  return Math.hypot(local.x, local.z)
}

/** Min distance (m) from point to any edge of the ring. */
export function distanceToPolygonEdgeM(point: LatLng, ring: LatLng[]): number {
  const poly = cleanRingLatLng(ring)
  if (poly.length < 2) return Number.POSITIVE_INFINITY
  const origin = poly[0]!
  const p = latLngToLocal(point, origin)
  const verts = poly.map((v) => latLngToLocal(v, origin))
  let best = Number.POSITIVE_INFINITY
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i]!
    const b = verts[(i + 1) % verts.length]!
    best = Math.min(best, distPointToSegment(p, a, b))
  }
  return best
}

function distPointToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x
  const abz = b.z - a.z
  const len2 = abx * abx + abz * abz
  if (len2 < 1e-12) return Math.hypot(p.x - a.x, p.z - a.z)
  let t = ((p.x - a.x) * abx + (p.z - a.z) * abz) / len2
  t = Math.max(0, Math.min(1, t))
  const qx = a.x + t * abx
  const qz = a.z + t * abz
  return Math.hypot(p.x - qx, p.z - qz)
}

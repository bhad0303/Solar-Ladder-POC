import type { LatLng, Vec2 } from '../types/project'

/** Mean Earth radius (meters) for local tangent-plane approx. */
export const EARTH_RADIUS_M = 6_378_137

const DEG2RAD = Math.PI / 180

export function metersPerDegreeLat(): number {
  return Math.PI * EARTH_RADIUS_M / 180
}

export function metersPerDegreeLng(latDeg: number): number {
  return (Math.PI / 180) * EARTH_RADIUS_M * Math.cos(latDeg * DEG2RAD)
}

/**
 * WGS84 → local meters relative to an origin.
 * Convention: +X east, +Z north (matches project types).
 */
export function latLngToLocal(
  point: LatLng,
  origin: LatLng,
): Vec2 {
  const east = (point.lng - origin.lng) * metersPerDegreeLng(origin.lat)
  const north = (point.lat - origin.lat) * metersPerDegreeLat()
  return { x: east, z: north }
}

export function localToLatLng(local: Vec2, origin: LatLng): LatLng {
  return {
    lat: origin.lat + local.z / metersPerDegreeLat(),
    lng: origin.lng + local.x / metersPerDegreeLng(origin.lat),
  }
}

import { describe, expect, it } from 'vitest'
import {
  cleanRingLatLng,
  pointInPolygonLatLng,
  polygonAreaM2,
} from '../src/osm/polygonMath'
import { latLngToLocal } from '../src/geo/localFrame'
import { selectBuildingWay } from '../src/osm/findBuildingFootprint'
import type { OverpassWay } from '../src/osm/overpass'

describe('polygonMath', () => {
  it('computes area of a 10×20 m rectangle in local meters', () => {
    const local = [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      { x: 10, z: 20 },
      { x: 0, z: 20 },
    ]
    expect(polygonAreaM2(local)).toBeCloseTo(200, 6)
  })

  it('detects point inside a lat/lng square', () => {
    const ring = [
      { lat: 19.0, lng: 72.0 },
      { lat: 19.0, lng: 72.001 },
      { lat: 19.001, lng: 72.001 },
      { lat: 19.001, lng: 72.0 },
    ]
    expect(pointInPolygonLatLng({ lat: 19.0005, lng: 72.0005 }, ring)).toBe(
      true,
    )
    expect(pointInPolygonLatLng({ lat: 19.002, lng: 72.0005 }, ring)).toBe(
      false,
    )
  })

  it('drops duplicate closing vertex', () => {
    const ring = [
      { lat: 1, lng: 2 },
      { lat: 1, lng: 3 },
      { lat: 2, lng: 3 },
      { lat: 1, lng: 2 },
    ]
    expect(cleanRingLatLng(ring)).toHaveLength(3)
  })
})

describe('selectBuildingWay', () => {
  const way = (id: number, geometry: Array<{ lat: number; lon: number }>): OverpassWay => ({
    type: 'way',
    id,
    tags: { building: 'yes' },
    geometry,
  })

  it('prefers containing building over neighbour', () => {
    const pin = { lat: 19.0005, lng: 72.0005 }
    const containing = way(1, [
      { lat: 19.0, lon: 72.0 },
      { lat: 19.0, lon: 72.001 },
      { lat: 19.001, lon: 72.001 },
      { lat: 19.001, lon: 72.0 },
      { lat: 19.0, lon: 72.0 },
    ])
    const neighbour = way(2, [
      { lat: 19.002, lon: 72.0 },
      { lat: 19.002, lon: 72.001 },
      { lat: 19.003, lon: 72.001 },
      { lat: 19.003, lon: 72.0 },
      { lat: 19.002, lon: 72.0 },
    ])
    const picked = selectBuildingWay(pin, [neighbour, containing])
    expect(picked?.way.id).toBe(1)
    expect(picked?.selection).toBe('contains')
  })

  it('falls back to nearest only when pin is within ~6m of an edge', () => {
    // ~4 m north of northern edge at lat 19.001
    const pin = { lat: 19.001036, lng: 72.0005 }
    const near = way(10, [
      { lat: 19.0, lon: 72.0 },
      { lat: 19.0, lon: 72.001 },
      { lat: 19.001, lon: 72.001 },
      { lat: 19.001, lon: 72.0 },
    ])
    const far = way(11, [
      { lat: 19.01, lon: 72.01 },
      { lat: 19.01, lon: 72.011 },
      { lat: 19.011, lon: 72.011 },
      { lat: 19.011, lon: 72.01 },
    ])
    const picked = selectBuildingWay(pin, [far, near])
    expect(picked?.way.id).toBe(10)
    expect(picked?.selection).toBe('nearest')
  })

  it('rejects far neighbours instead of picking the wrong building', () => {
    const pin = { lat: 19.0012, lng: 72.0005 }
    const near = way(10, [
      { lat: 19.0, lon: 72.0 },
      { lat: 19.0, lon: 72.001 },
      { lat: 19.001, lon: 72.001 },
      { lat: 19.001, lon: 72.0 },
    ])
    expect(selectBuildingWay(pin, [near])).toBeNull()
  })
})

describe('localFrame', () => {
  it('maps 1° lat ≈ 111 km north', () => {
    const origin = { lat: 0, lng: 0 }
    const p = latLngToLocal({ lat: 1, lng: 0 }, origin)
    expect(p.x).toBeCloseTo(0, 3)
    expect(p.z).toBeGreaterThan(110_000)
    expect(p.z).toBeLessThan(112_000)
  })
})

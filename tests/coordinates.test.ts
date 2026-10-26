import { describe, expect, it } from 'vitest'
import {
  latLngToLocal,
  localToLatLng,
  metersPerDegreeLat,
} from '../src/geo/coordinates'
import type { ProjectLocation } from '../src/data/types'

const location: ProjectLocation = {
  lat: 19.076,
  lon: 72.8777,
  timeZone: 'Asia/Kolkata',
  northOffsetDeg: 0,
}

describe('coordinates', () => {
  it('round-trips lat/lon near location', () => {
    const local = latLngToLocal(19.0765, 72.8782, location)
    const back = localToLatLng(local, location)
    expect(back.lat).toBeCloseTo(19.0765, 5)
    expect(back.lon).toBeCloseTo(72.8782, 5)
  })

  it('maps north to −Z when northOffset is 0', () => {
    const north = latLngToLocal(location.lat + 0.001, location.lon, location)
    expect(north.x).toBeCloseTo(0, 3)
    expect(north.z).toBeLessThan(0)
    expect(Math.abs(north.z)).toBeCloseTo(0.001 * metersPerDegreeLat(), 0)
  })

  it('applies northOffsetDeg rotation', () => {
    const rotated = { ...location, northOffsetDeg: 90 }
    const east = latLngToLocal(location.lat, location.lon + 0.001, rotated)
    expect(Math.abs(east.x)).toBeLessThan(Math.abs(east.z) + 1)
  })
})

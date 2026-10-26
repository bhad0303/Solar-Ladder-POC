import { describe, expect, it } from 'vitest'
import {
  getSunDirection,
  sunCalcAzimuthToBearingFromNorthDeg,
} from '../src/geo/sunMath'
import { JUNE_21_DOY, NOON_MINUTE } from '../src/geo/coordinates'

describe('sunMath', () => {
  it('maps SunCalc south azimuth to bearing 180° from north', () => {
    expect(sunCalcAzimuthToBearingFromNorthDeg(0)).toBeCloseTo(180, 5)
  })

  it('returns upward sun near noon in Mumbai on June 21', () => {
    const sun = getSunDirection(
      JUNE_21_DOY,
      NOON_MINUTE,
      19.076,
      72.8777,
      'Asia/Kolkata',
    )
    expect(sun.isUp).toBe(true)
    expect(sun.dir.y).toBeGreaterThan(0.2)
    expect(Math.hypot(sun.dir.x, sun.dir.y, sun.dir.z)).toBeCloseTo(1, 5)
  })

  it('returns down / low sun at midnight', () => {
    const sun = getSunDirection(JUNE_21_DOY, 0, 19.076, 72.8777, 'Asia/Kolkata')
    expect(sun.isUp).toBe(false)
  })
})

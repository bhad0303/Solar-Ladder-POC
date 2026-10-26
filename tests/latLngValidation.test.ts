import { describe, expect, it } from 'vitest'
import { isValidLat, isValidLatLng, isValidLng } from '../src/types/project'

describe('lat/lng validation', () => {
  it('accepts valid Mumbai coords', () => {
    expect(isValidLatLng(19.076, 72.8777)).toBe(true)
  })

  it('rejects out-of-range latitude', () => {
    expect(isValidLat(91)).toBe(false)
    expect(isValidLat(-91)).toBe(false)
  })

  it('rejects out-of-range longitude', () => {
    expect(isValidLng(181)).toBe(false)
    expect(isValidLng(-181)).toBe(false)
  })

  it('rejects non-finite values', () => {
    expect(isValidLatLng(Number.NaN, 0)).toBe(false)
    expect(isValidLatLng(0, Number.POSITIVE_INFINITY)).toBe(false)
  })
})

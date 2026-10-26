import { describe, expect, it } from 'vitest'
import { footprintRectangle } from '../src/roofPreview/geometry/footprints'
import {
  insetPolygon,
  pointInPolygon,
  signedArea,
} from '../src/roofPreview/geometry/polygon'
import { validateHouseConfig } from '../src/roofPreview/geometry/validateDims'
import { DEFAULT_HOUSE } from '../src/roofPreview/types'

describe('pointInPolygon', () => {
  const rect = footprintRectangle({ lengthM: 10, widthM: 6 })

  it('detects interior points', () => {
    expect(pointInPolygon({ x: 0, z: 0 }, rect)).toBe(true)
  })

  it('detects exterior points', () => {
    expect(pointInPolygon({ x: 20, z: 0 }, rect)).toBe(false)
  })
})

describe('insetPolygon', () => {
  it('shrinks a rectangle by setback', () => {
    const rect = footprintRectangle({ lengthM: 10, widthM: 6 })
    const inset = insetPolygon(rect, 0.5)
    expect(inset).not.toBeNull()
    expect(signedArea(inset!)).toBeLessThan(signedArea(rect))
    expect(pointInPolygon({ x: 0, z: 0 }, inset!)).toBe(true)
    expect(pointInPolygon({ x: 4.8, z: 0 }, inset!)).toBe(false)
  })

  it('returns null when setback eats the polygon', () => {
    const rect = footprintRectangle({ lengthM: 2, widthM: 2 })
    // setback >= half-width collapses the inset
    expect(insetPolygon(rect, 1.0)).toBeNull()
  })
})

describe('validateHouseConfig', () => {
  it('accepts defaults', () => {
    expect(validateHouseConfig(DEFAULT_HOUSE).ok).toBe(true)
  })

  it('rejects cut-out larger than house without fixing', () => {
    const bad = {
      ...DEFAULT_HOUSE,
      shape: 'l' as const,
      l: {
        ...DEFAULT_HOUSE.l,
        cutoutLengthM: 20,
        totalLengthM: 12,
      },
    }
    const r = validateHouseConfig(bad)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/Cut-out length/i)
  })

  it('rejects zero sizes', () => {
    const bad = {
      ...DEFAULT_HOUSE,
      shape: 'rectangle' as const,
      rectangle: { lengthM: 0, widthM: 8 },
    }
    expect(validateHouseConfig(bad).ok).toBe(false)
  })
})

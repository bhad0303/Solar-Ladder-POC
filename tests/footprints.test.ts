import { describe, expect, it } from 'vitest'
import {
  footprintL,
  footprintRectangle,
  footprintT,
  footprintU,
  rectangularSections,
} from '../src/roofPreview/geometry/footprints'
import { signedArea } from '../src/roofPreview/geometry/polygon'

describe('footprintRectangle', () => {
  it('returns 4 CCW points centered on origin', () => {
    const p = footprintRectangle({ lengthM: 10, widthM: 6 })
    expect(p).toHaveLength(4)
    expect(signedArea(p)).toBeGreaterThan(0)
    expect(p[0]).toEqual({ x: -5, z: -3 })
  })
})

describe('footprintL', () => {
  it('returns 6 vertices for NE cut-out', () => {
    const p = footprintL({
      totalLengthM: 12,
      totalWidthM: 10,
      cutoutLengthM: 5,
      cutoutWidthM: 4,
      cutoutCorner: 'NE',
    })
    expect(p).toHaveLength(6)
    expect(signedArea(p)).toBeGreaterThan(0)
  })

  it('has no duplicate consecutive points', () => {
    const p = footprintL({
      totalLengthM: 12,
      totalWidthM: 10,
      cutoutLengthM: 5,
      cutoutWidthM: 4,
      cutoutCorner: 'SW',
    })
    for (let i = 0; i < p.length; i++) {
      const a = p[i]!
      const b = p[(i + 1) % p.length]!
      expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(1e-6)
    }
  })
})

describe('footprintU', () => {
  it('returns 8 vertices', () => {
    const p = footprintU({
      totalLengthM: 14,
      totalWidthM: 10,
      cutoutLengthM: 6,
      cutoutWidthM: 5,
    })
    expect(p).toHaveLength(8)
    expect(signedArea(p)).toBeGreaterThan(0)
  })
})

describe('footprintT', () => {
  it('returns 8 vertices', () => {
    const p = footprintT({
      totalLengthM: 12,
      totalWidthM: 10,
      stemWidthM: 4,
      crossbarDepthM: 4,
    })
    expect(p).toHaveLength(8)
    expect(signedArea(p)).toBeGreaterThan(0)
  })
})

describe('rectangularSections', () => {
  it('splits L into 2 rectangles', () => {
    const secs = rectangularSections({
      shape: 'l',
      dims: {
        totalLengthM: 12,
        totalWidthM: 10,
        cutoutLengthM: 5,
        cutoutWidthM: 4,
        cutoutCorner: 'NE',
      },
    })
    expect(secs).toHaveLength(2)
    for (const s of secs) expect(s).toHaveLength(4)
  })
})

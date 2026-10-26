import { describe, expect, it } from 'vitest'
import {
  layoutPanelsOnPolygon,
  pointInPolygonLocal,
} from '../src/panels/layoutPanels'

describe('layoutPanelsOnPolygon', () => {
  const square = [
    { x: 0, z: 0 },
    { x: 20, z: 0 },
    { x: 20, z: 20 },
    { x: 0, z: 20 },
  ]

  it('places multiple panels inside a 20×20 m roof', () => {
    const panels = layoutPanelsOnPolygon(square, 5)
    expect(panels.length).toBeGreaterThan(20)
    for (const p of panels) {
      expect(pointInPolygonLocal({ x: p.x, z: p.z }, square)).toBe(true)
      expect(p.y).toBeGreaterThan(5)
      expect(p.azimuthDeg).toBe(180)
    }
  })

  it('returns empty for tiny footprint', () => {
    const tiny = [
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 1, z: 1 },
      { x: 0, z: 1 },
    ]
    expect(layoutPanelsOnPolygon(tiny, 3)).toEqual([])
  })
})

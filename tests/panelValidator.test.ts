import { describe, expect, it } from 'vitest'
import { footprintRectangle } from '../src/roofPreview/geometry/footprints'
import {
  autoFillPanels,
  totalKw,
  validatePanelPlacement,
} from '../src/roofPreview/geometry/panelValidator'
import { DEFAULT_PANEL_SETTINGS } from '../src/roofPreview/types'

describe('validatePanelPlacement', () => {
  const roof = footprintRectangle({ lengthM: 12, widthM: 8 })

  it('accepts a panel inside setback', () => {
    const r = validatePanelPlacement(
      roof,
      0.5,
      { x: 0, z: 0, widthM: 1.134, heightM: 2.278, yawRad: 0 },
      [],
    )
    expect(r.ok).toBe(true)
  })

  it('rejects a panel outside the roof', () => {
    const r = validatePanelPlacement(
      roof,
      0.5,
      { x: 20, z: 0, widthM: 1.134, heightM: 2.278, yawRad: 0 },
      [],
    )
    expect(r.ok).toBe(false)
  })

  it('rejects overlapping panels', () => {
    const existing = [
      {
        id: 'a',
        position: { x: 0, y: 3, z: 0 },
        tiltDeg: 18,
        azimuthDeg: 180,
        widthM: 1.134,
        heightM: 2.278,
      },
    ]
    const r = validatePanelPlacement(
      roof,
      0.5,
      { x: 0.2, z: 0.2, widthM: 1.134, heightM: 2.278, yawRad: Math.PI },
      existing,
    )
    expect(r.ok).toBe(false)
  })
})

describe('autoFillPanels', () => {
  it('places only panels that fit', () => {
    const roof = footprintRectangle({ lengthM: 12, widthM: 8 })
    const panels = autoFillPanels(roof, DEFAULT_PANEL_SETTINGS, 3.1, 180)
    expect(panels.length).toBeGreaterThan(0)
    for (const p of panels) {
      const r = validatePanelPlacement(
        roof,
        DEFAULT_PANEL_SETTINGS.setbackM,
        {
          x: p.position.x,
          z: p.position.z,
          widthM: p.widthM,
          heightM: p.heightM,
          yawRad: (p.azimuthDeg * Math.PI) / 180,
        },
        panels,
        p.id,
      )
      expect(r.ok).toBe(true)
    }
  })
})

describe('totalKw', () => {
  it('computes from count and watt', () => {
    expect(totalKw([{ id: '1' } as never, { id: '2' } as never], 540)).toBeCloseTo(
      1.08,
    )
  })
})

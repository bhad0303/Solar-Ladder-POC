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

  it('returns no panels when panel is larger than usable roof', () => {
    const roof = footprintRectangle({ lengthM: 2, widthM: 2 })
    const panels = autoFillPanels(
      roof,
      {
        ...DEFAULT_PANEL_SETTINGS,
        widthM: 3,
        heightM: 3,
        setbackM: 0.5,
      },
      3.1,
      180,
    )
    expect(panels).toHaveLength(0)
  })

  it('honors panelGapM vs denser packing', () => {
    const roof = footprintRectangle({ lengthM: 20, widthM: 12 })
    const tight = autoFillPanels(
      roof,
      { ...DEFAULT_PANEL_SETTINGS, panelGapM: 0.02, rowSpacingM: 0.3 },
      3.1,
      180,
    )
    const loose = autoFillPanels(
      roof,
      { ...DEFAULT_PANEL_SETTINGS, panelGapM: 0.5, rowSpacingM: 0.3 },
      3.1,
      180,
    )
    expect(tight.length).toBeGreaterThanOrEqual(loose.length)
  })

  it('portrait vs landscape changes count', () => {
    const roof = footprintRectangle({ lengthM: 14, widthM: 10 })
    const portrait = autoFillPanels(
      roof,
      { ...DEFAULT_PANEL_SETTINGS, orientation: 'portrait' },
      3.1,
      180,
    )
    const landscape = autoFillPanels(
      roof,
      { ...DEFAULT_PANEL_SETTINGS, orientation: 'landscape' },
      3.1,
      180,
    )
    expect(portrait.length).not.toBe(landscape.length)
  })
})

describe('totalKw', () => {
  it('computes from count and watt', () => {
    expect(totalKw([{ id: '1' } as never, { id: '2' } as never], 540)).toBeCloseTo(
      1.08,
    )
  })
})

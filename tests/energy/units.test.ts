import { describe, expect, it } from 'vitest'
import {
  kwToW,
  lengthDisplayToM,
  lengthMToDisplay,
  powerDisplayToW,
  roundForDisplay,
  wToKw,
} from '../../src/roofPreview/energy/units'

describe('energy units', () => {
  it('converts mm to meters', () => {
    expect(lengthDisplayToM(1134, 'mm')).toBeCloseTo(1.134)
    expect(lengthMToDisplay(1.134, 'mm')).toBeCloseTo(1134)
  })

  it('converts kW to W', () => {
    expect(kwToW(0.54)).toBeCloseTo(540)
    expect(wToKw(540)).toBeCloseTo(0.54)
    expect(powerDisplayToW(0.54, 'kW')).toBeCloseTo(540)
  })

  it('rounds for display only without -0', () => {
    expect(roundForDisplay(-0.0001, 2)).toBe(0)
    expect(Object.is(roundForDisplay(-0, 2), -0)).toBe(false)
  })
})

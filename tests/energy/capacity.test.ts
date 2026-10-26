import { describe, expect, it } from 'vitest'
import {
  buildSystemSummary,
  installedCapacityKw,
} from '../../src/roofPreview/energy/capacity'

describe('capacity', () => {
  it('derives installed capacity from count × W', () => {
    expect(installedCapacityKw(15, 540)).toBeCloseTo(8.1)
  })

  it('returns 0 for invalid inputs', () => {
    expect(installedCapacityKw(0, 540)).toBe(0)
    expect(installedCapacityKw(10, NaN)).toBe(0)
  })

  it('builds system summary with coverage', () => {
    const s = buildSystemSummary({
      panelCount: 10,
      widthM: 1,
      heightM: 2,
      ratedPowerW: 500,
      usableRoofAreaM2: 100,
    })
    expect(s.installedCapacityKw).toBe(5)
    expect(s.panelAreaM2).toBe(20)
    expect(s.roofCoveragePercent).toBe(20)
  })
})

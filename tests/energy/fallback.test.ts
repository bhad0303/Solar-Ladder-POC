import { describe, expect, it } from 'vitest'
import { FallbackEnergyEstimateProvider } from '../../src/roofPreview/energy/FallbackEnergyEstimateProvider'

describe('FallbackEnergyEstimateProvider', () => {
  it('matches the example 15×540 W @ 4.5 h and 14% loss', async () => {
    const p = new FallbackEnergyEstimateProvider()
    const e = await p.estimate({
      latitude: 19,
      longitude: 72,
      installedCapacityKw: 8.1,
      panelTiltDeg: 15,
      panelAzimuthDeg: 180,
      systemLossPercent: 14,
      moduleType: 'standard',
      selectedMonth: 5,
      peakSunHoursPerDay: 4.5,
      year: 2024,
    })
    expect(e.source).toBe('fallback')
    // 8.1 × 4.5 × 0.86 = 31.347 (docs round to 31.35)
    expect(e.averageDailyEnergyKwh).toBeCloseTo(31.35, 1)
    expect(e.annualEnergyKwh).toBeCloseTo(e.averageDailyEnergyKwh * 365, 5)
    expect(e.monthlyEnergyKwh).toEqual([])
    expect(e.selectedMonthEnergyKwh).toBeCloseTo(
      e.averageDailyEnergyKwh * 30,
      5,
    ) // June 2024
  })
})

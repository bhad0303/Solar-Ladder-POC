import { describe, expect, it } from 'vitest'
import {
  compassToPvgisAspect,
  moduleTypeToPvgis,
  parsePvgisResponse,
} from '../../src/roofPreview/energy/PvgisEnergyEstimateProvider'

describe('PVGIS helpers', () => {
  it('converts compass azimuth to PVGIS aspect', () => {
    expect(compassToPvgisAspect(180)).toBe(0) // south
    expect(compassToPvgisAspect(270)).toBe(90) // west
    expect(compassToPvgisAspect(90)).toBe(-90) // east
  })

  it('maps module types', () => {
    expect(moduleTypeToPvgis('standard')).toBe('crystSi')
    expect(moduleTypeToPvgis('premium')).toBe('crystSi')
    expect(moduleTypeToPvgis('thin-film')).toBe('CdTe')
  })

  it('parses a valid PVGIS-like JSON payload', () => {
    const monthly = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      E_m: 100 + i,
    }))
    const estimate = parsePvgisResponse(
      {
        outputs: {
          totals: { fixed: { E_y: 1500 } },
          monthly: { fixed: monthly },
        },
      },
      {
        latitude: 45,
        longitude: 8,
        installedCapacityKw: 1,
        panelTiltDeg: 15,
        panelAzimuthDeg: 180,
        systemLossPercent: 14,
        moduleType: 'standard',
        selectedMonth: 0,
        peakSunHoursPerDay: 4.5,
        year: 2024,
      },
    )
    expect(estimate.source).toBe('pvgis')
    expect(estimate.annualEnergyKwh).toBe(1500)
    expect(estimate.monthlyEnergyKwh).toHaveLength(12)
    expect(estimate.selectedMonthEnergyKwh).toBe(100)
  })

  it('rejects invalid JSON energy', () => {
    expect(() =>
      parsePvgisResponse(
        { outputs: { totals: { fixed: { E_y: NaN } } } },
        {
          latitude: 1,
          longitude: 1,
          installedCapacityKw: 1,
          panelTiltDeg: 10,
          panelAzimuthDeg: 180,
          systemLossPercent: 14,
          moduleType: 'standard',
          selectedMonth: 0,
          peakSunHoursPerDay: 4.5,
        },
      ),
    ).toThrow()
  })
})

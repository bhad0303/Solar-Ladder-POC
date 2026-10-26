import { describe, expect, it } from 'vitest'
import { parseNasaPowerResponse } from '../../src/roofPreview/energy/NasaPowerEnergyEstimateProvider'

const sample = {
  properties: {
    parameter: {
      ALLSKY_SFC_SW_DWN: {
        '202201': 4.6,
        '202202': 5.8,
        '202203': 6.0,
        '202204': 6.7,
        '202205': 6.7,
        '202206': 5.2,
        '202207': 3.6,
        '202208': 4.4,
        '202209': 4.1,
        '202210': 5.1,
        '202211': 5.0,
        '202212': 4.3,
        '202213': 5.1,
      },
    },
  },
}

describe('parseNasaPowerResponse', () => {
  it('builds monthly + annual energy from insolation', () => {
    const e = parseNasaPowerResponse(
      sample,
      {
        latitude: 19.076,
        longitude: 72.8777,
        installedCapacityKw: 4.32,
        panelTiltDeg: 15,
        panelAzimuthDeg: 180,
        systemLossPercent: 14,
        moduleType: 'standard',
        selectedMonth: 5,
        peakSunHoursPerDay: 4.5,
      },
      2022,
    )
    expect(e.source).toBe('nasa-power')
    expect(e.monthlyEnergyKwh).toHaveLength(12)
    expect(e.annualEnergyKwh).toBeGreaterThan(1000)
    expect(e.selectedMonthEnergyKwh).toBeCloseTo(
      4.32 * 5.2 * 0.86 * 30,
      0,
    )
  })
})

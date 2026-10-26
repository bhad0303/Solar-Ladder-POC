import {
  averageDailyFromAnnual,
  averageDailyFromMonth,
  daysInMonth,
} from './calendar'
import type {
  EnergyEstimate,
  EnergyEstimateInput,
  EnergyEstimateProvider,
} from './types'

/**
 * Approximate POC estimator — not location-based seasonal data.
 * Does not fabricate a 12-month seasonal chart.
 */
export class FallbackEnergyEstimateProvider implements EnergyEstimateProvider {
  async estimate(input: EnergyEstimateInput): Promise<EnergyEstimate> {
    const year = input.year ?? new Date().getFullYear()
    const month = Math.min(11, Math.max(0, Math.floor(input.selectedMonth)))
    const capacity = input.installedCapacityKw
    const psh = input.peakSunHoursPerDay
    const loss = input.systemLossPercent
    const pr = 1 - loss / 100

    const assumptions = [
      `Peak sun hours: ${psh} h/day (user advanced assumption)`,
      `Performance ratio: ${(pr * 100).toFixed(0)}% from ${loss}% system losses`,
      'Fallback formula: daily kWh = capacity kW × peak sun hours × performance ratio',
      'Annual = average daily × 365 (no seasonal monthly series)',
      'Estimated, not guaranteed',
    ]

    const warnings = [
      'Approximate estimate only — not based on location-specific irradiance data.',
      'Live PVGIS was unavailable for this request (network, timeout, or proxy); fallback applied.',
    ]

    if (!(capacity > 0) || !(psh > 0) || !(pr >= 0)) {
      return {
        source: 'fallback',
        calculatedAt: new Date().toISOString(),
        annualEnergyKwh: 0,
        monthlyEnergyKwh: [],
        averageDailyEnergyKwh: 0,
        selectedMonthEnergyKwh: 0,
        selectedMonthAverageDailyKwh: 0,
        assumptions,
        warnings: [
          ...warnings,
          'Installed capacity is zero or assumptions are invalid — no energy estimated.',
        ],
      }
    }

    const averageDailyEnergyKwh = capacity * psh * pr
    const annualEnergyKwh = averageDailyEnergyKwh * 365
    const days = daysInMonth(year, month)
    const selectedMonthEnergyKwh = averageDailyEnergyKwh * days
    const selectedMonthAverageDailyKwh = averageDailyFromMonth(
      selectedMonthEnergyKwh,
      year,
      month,
    )

    const capacityFactorPercent =
      capacity > 0
        ? (averageDailyFromAnnual(annualEnergyKwh) / (capacity * 24)) * 100
        : undefined

    return {
      source: 'fallback',
      calculatedAt: new Date().toISOString(),
      annualEnergyKwh,
      monthlyEnergyKwh: [],
      averageDailyEnergyKwh,
      selectedMonthEnergyKwh,
      selectedMonthAverageDailyKwh,
      capacityFactorPercent,
      assumptions,
      warnings,
    }
  }
}

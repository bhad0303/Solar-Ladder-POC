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

const DEFAULT_TIMEOUT_MS = 12_000

type NasaMonthlyJson = {
  properties?: {
    parameter?: {
      ALLSKY_SFC_SW_DWN?: Record<string, number>
    }
  }
  messages?: string[]
}

/**
 * NASA POWER monthly insolation (kWh/m²/day ≈ peak sun hours).
 * Browser-callable (Access-Control-Allow-Origin: *) — works on Vercel when
 * JRC PVGIS WAF blocks cloud IPs.
 */
export function buildNasaPowerUrl(
  lat: number,
  lon: number,
  year: number,
): string {
  const params = new URLSearchParams({
    parameters: 'ALLSKY_SFC_SW_DWN',
    community: 'RE',
    longitude: String(lon),
    latitude: String(lat),
    start: String(year),
    end: String(year),
    format: 'JSON',
  })
  return `https://power.larc.nasa.gov/api/temporal/monthly/point?${params}`
}

export function parseNasaPowerResponse(
  json: unknown,
  input: EnergyEstimateInput,
  year: number,
): EnergyEstimate {
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid NASA POWER JSON')
  }
  const data = json as NasaMonthlyJson
  const series = data.properties?.parameter?.ALLSKY_SFC_SW_DWN
  if (!series || typeof series !== 'object') {
    throw new Error('NASA POWER response missing insolation series')
  }

  const pr = Math.max(0, Math.min(1, (100 - input.systemLossPercent) / 100))
  const kw = input.installedCapacityKw
  const month = Math.min(11, Math.max(0, Math.floor(input.selectedMonth)))

  const monthlyEnergyKwh: number[] = Array.from({ length: 12 }, () => 0)
  for (let m = 0; m < 12; m++) {
    const key = `${year}${String(m + 1).padStart(2, '0')}`
    const h = Number(series[key])
    if (!Number.isFinite(h) || h < 0) {
      throw new Error(`NASA POWER missing month ${key}`)
    }
    const days = daysInMonth(year, m)
    // E = P_kWp × H_(kWh/m²/day) × PR × days  (horizontal irradiance approx)
    monthlyEnergyKwh[m] = kw * h * pr * days
  }

  const annualKey = `${year}13`
  const annualH = Number(series[annualKey])
  let annualEnergyKwh = monthlyEnergyKwh.reduce((a, b) => a + b, 0)
  if (Number.isFinite(annualH) && annualH > 0) {
    // Prefer sum of months; annual average used only as sanity check
    const fromAnnual = kw * annualH * pr * 365
    if (Math.abs(fromAnnual - annualEnergyKwh) / Math.max(annualEnergyKwh, 1) > 0.25) {
      // large mismatch — keep monthly sum
    }
  }

  if (!(annualEnergyKwh > 0)) {
    throw new Error('NASA POWER produced zero annual energy')
  }

  const selectedMonthEnergyKwh = monthlyEnergyKwh[month]!
  const averageDailyEnergyKwh = averageDailyFromAnnual(annualEnergyKwh)
  const selectedMonthAverageDailyKwh = averageDailyFromMonth(
    selectedMonthEnergyKwh,
    year,
    month,
  )
  const capacityFactorPercent =
    kw > 0 ? (averageDailyEnergyKwh / (kw * 24)) * 100 : undefined

  return {
    source: 'nasa-power',
    calculatedAt: new Date().toISOString(),
    annualEnergyKwh,
    monthlyEnergyKwh,
    averageDailyEnergyKwh,
    selectedMonthEnergyKwh,
    selectedMonthAverageDailyKwh,
    capacityFactorPercent,
    assumptions: [
      `Source: NASA POWER monthly ALLSKY_SFC_SW_DWN (${year})`,
      `System losses / PR: ${input.systemLossPercent}% → ${(pr * 100).toFixed(0)}%`,
      `Horizontal irradiance × capacity (tilt ${input.panelTiltDeg}° not modeled in NASA path)`,
      'Location-specific insolation; estimated, not guaranteed',
    ],
    warnings: [
      'NASA POWER used because live PVGIS was blocked (common on cloud hosts / WAF).',
      'Irradiance is horizontal — real tilted yield may differ slightly.',
    ],
  }
}

export class NasaPowerEnergyEstimateProvider implements EnergyEstimateProvider {
  private timeoutMs: number

  constructor(opts?: { timeoutMs?: number }) {
    this.timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  async estimate(
    input: EnergyEstimateInput,
    signal?: AbortSignal,
  ): Promise<EnergyEstimate> {
    if (!(input.installedCapacityKw > 0)) {
      throw new Error('Installed capacity is zero — skipping NASA POWER')
    }
    // Prefer a completed calendar year
    const year = Math.min(
      (input.year ?? new Date().getFullYear()) - 1,
      new Date().getFullYear() - 1,
    )
    const url = buildNasaPowerUrl(input.latitude, input.longitude, year)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs)
    const onAbort = () => ctrl.abort()
    signal?.addEventListener('abort', onAbort)

    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: ctrl.signal,
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) {
        throw new Error(`NASA POWER HTTP ${res.status}`)
      }
      const json: unknown = await res.json()
      return parseNasaPowerResponse(json, input, year)
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  }
}

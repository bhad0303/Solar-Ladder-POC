import {
  averageDailyFromAnnual,
  averageDailyFromMonth,
  daysInMonth,
} from './calendar'
import type {
  EnergyEstimate,
  EnergyEstimateInput,
  EnergyEstimateProvider,
  ModuleType,
} from './types'

/**
 * Same-origin proxy path:
 * - Local: Vite `server.proxy` `/pvgis-api` → JRC
 * - Vercel: rewrite → Edge function `api/pvgis/[...path]`
 */
export function pvgisEndpoint(): string {
  if (typeof window !== 'undefined') {
    return '/pvgis-api/PVcalc'
  }
  return 'https://re.jrc.ec.europa.eu/api/v5_3/PVcalc'
}

const DEFAULT_TIMEOUT_MS = 12_000

type CacheEntry = { at: number; estimate: EnergyEstimate }

/** Compass azimuth (0=N, 90=E, 180=S) → PVGIS aspect (0=south, 90=west, -90=east). */
export function compassToPvgisAspect(azimuthDeg: number): number {
  let a = ((azimuthDeg - 180) % 360 + 360) % 360
  if (a > 180) a -= 360
  return a
}

export function moduleTypeToPvgis(moduleType: ModuleType): string {
  switch (moduleType) {
    case 'premium':
      // PVGIS accepts crystSi; keep premium as crystalline for API stability
      return 'crystSi'
    case 'thin-film':
      return 'CdTe'
    default:
      return 'crystSi'
  }
}

export function buildPvgisUrl(input: EnergyEstimateInput): string {
  const params = new URLSearchParams({
    lat: String(input.latitude),
    lon: String(input.longitude),
    peakpower: String(input.installedCapacityKw),
    loss: String(input.systemLossPercent),
    angle: String(input.panelTiltDeg),
    aspect: String(compassToPvgisAspect(input.panelAzimuthDeg)),
    pvtechchoice: moduleTypeToPvgis(input.moduleType),
    mountingplace: 'building',
    fixed: '1',
    outputformat: 'json',
  })
  return `${pvgisEndpoint()}?${params.toString()}`
}

export function cacheKey(input: EnergyEstimateInput): string {
  return [
    input.latitude.toFixed(5),
    input.longitude.toFixed(5),
    input.installedCapacityKw.toFixed(4),
    input.panelTiltDeg,
    input.panelAzimuthDeg,
    input.systemLossPercent,
    input.moduleType,
    input.selectedMonth,
  ].join('|')
}

type PvgisJson = {
  outputs?: {
    totals?: {
      fixed?: {
        E_y?: number
        E_m?: number
      }
    }
    monthly?: {
      fixed?: Array<{ month?: number; E_m?: number }>
    }
  }
  message?: string
}

export function parsePvgisResponse(
  json: unknown,
  input: EnergyEstimateInput,
): EnergyEstimate {
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid PVGIS JSON')
  }
  const data = json as PvgisJson
  if (data.message && !data.outputs) {
    throw new Error(String(data.message))
  }
  const year = input.year ?? new Date().getFullYear()
  const month = Math.min(11, Math.max(0, Math.floor(input.selectedMonth)))

  const monthlyRaw = data.outputs?.monthly?.fixed
  const monthlyEnergyKwh: number[] = Array.from({ length: 12 }, () => 0)
  if (Array.isArray(monthlyRaw)) {
    for (const row of monthlyRaw) {
      const m = Number(row.month)
      const e = Number(row.E_m)
      if (Number.isFinite(m) && m >= 1 && m <= 12 && Number.isFinite(e)) {
        monthlyEnergyKwh[m - 1] = e
      }
    }
  }

  let annualEnergyKwh = Number(data.outputs?.totals?.fixed?.E_y)
  if (!Number.isFinite(annualEnergyKwh) || annualEnergyKwh < 0) {
    const sum = monthlyEnergyKwh.reduce((a, b) => a + b, 0)
    if (sum > 0) annualEnergyKwh = sum
    else throw new Error('PVGIS response missing annual energy')
  }

  const hasFullMonthly = monthlyEnergyKwh.every((v) => Number.isFinite(v))
  const selectedMonthEnergyKwh = hasFullMonthly
    ? monthlyEnergyKwh[month]!
    : Number(data.outputs?.totals?.fixed?.E_m) || annualEnergyKwh / 12

  if (
    !Number.isFinite(selectedMonthEnergyKwh) ||
    !Number.isFinite(annualEnergyKwh) ||
    annualEnergyKwh < 0
  ) {
    throw new Error('PVGIS response contained invalid energy values')
  }

  const averageDailyEnergyKwh = averageDailyFromAnnual(annualEnergyKwh)
  const selectedMonthAverageDailyKwh = averageDailyFromMonth(
    selectedMonthEnergyKwh,
    year,
    month,
  )

  const capacityFactorPercent =
    input.installedCapacityKw > 0
      ? (averageDailyEnergyKwh / (input.installedCapacityKw * 24)) * 100
      : undefined

  return {
    source: 'pvgis',
    calculatedAt: new Date().toISOString(),
    annualEnergyKwh,
    monthlyEnergyKwh: hasFullMonthly ? monthlyEnergyKwh : [],
    averageDailyEnergyKwh,
    selectedMonthEnergyKwh,
    selectedMonthAverageDailyKwh,
    capacityFactorPercent,
    assumptions: [
      'Source: JRC PVGIS 5.3 PVcalc (grid-connected, building-mounted)',
      `System losses: ${input.systemLossPercent}%`,
      `Tilt ${input.panelTiltDeg}°, compass azimuth ${input.panelAzimuthDeg}°`,
      'Monthly and annual values from PVGIS climatological averages',
      'Estimated, not guaranteed',
    ],
    warnings: hasFullMonthly
      ? []
      : ['PVGIS returned partial monthly data; chart may be incomplete.'],
  }
}

export class PvgisEnergyEstimateProvider implements EnergyEstimateProvider {
  private cache = new Map<string, CacheEntry>()
  private timeoutMs: number

  constructor(opts?: { timeoutMs?: number }) {
    this.timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  clearCache(): void {
    this.cache.clear()
  }

  async estimate(
    input: EnergyEstimateInput,
    signal?: AbortSignal,
  ): Promise<EnergyEstimate> {
    if (!(input.installedCapacityKw > 0)) {
      throw new Error('Installed capacity is zero — skipping PVGIS')
    }
    if (
      !Number.isFinite(input.latitude) ||
      !Number.isFinite(input.longitude) ||
      Math.abs(input.latitude) > 90 ||
      Math.abs(input.longitude) > 180
    ) {
      throw new Error('Latitude or longitude is invalid')
    }

    const key = cacheKey(input)
    const hit = this.cache.get(key)
    if (hit && Date.now() - hit.at < 15 * 60_000) {
      return {
        ...hit.estimate,
        calculatedAt: hit.estimate.calculatedAt,
        warnings: [
          ...hit.estimate.warnings,
          'Served from in-memory PVGIS cache.',
        ],
      }
    }

    const url = buildPvgisUrl(input)
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
      if (res.status === 429) {
        throw new Error('PVGIS rate limit (429 Too Many Requests)')
      }
      if (res.status === 529) {
        throw new Error('PVGIS overloaded (529) — retry later')
      }
      const text = await res.text()
      if (
        /requested URL was rejected/i.test(text) ||
        /support ID/i.test(text) ||
        /jrc-waf/i.test(text)
      ) {
        throw new Error(
          'PVGIS WAF blocked this host (common on Vercel/cloud IPs)',
        )
      }
      let json: unknown
      try {
        json = JSON.parse(text) as unknown
      } catch {
        if (!res.ok) throw new Error(`PVGIS HTTP ${res.status}`)
        throw new Error('PVGIS returned non-JSON body')
      }
      if (
        json &&
        typeof json === 'object' &&
        'waf' in json &&
        (json as { waf?: boolean }).waf
      ) {
        throw new Error(
          'PVGIS WAF blocked this host (common on Vercel/cloud IPs)',
        )
      }
      if (!res.ok) {
        const msg =
          json &&
          typeof json === 'object' &&
          'message' in json &&
          typeof (json as { message: unknown }).message === 'string'
            ? (json as { message: string }).message
            : `PVGIS HTTP ${res.status}`
        throw new Error(msg)
      }
      const estimate = parsePvgisResponse(json, input)
      this.cache.set(key, { at: Date.now(), estimate })
      return estimate
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  }
}

/** Exported for tests — days helper re-export unused guard */
export function _daysInMonthForTests(year: number, month: number): number {
  return daysInMonth(year, month)
}

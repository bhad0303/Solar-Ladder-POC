function cleanZero(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Object.is(n, -0) ? 0 : n
}

export function formatKw(kw: number, locale = 'en'): string {
  const v = cleanZero(kw)
  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(v)} kW`
}

export function formatPanelCount(n: number, locale = 'en'): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    Math.max(0, Math.floor(cleanZero(n))),
  )
}

export type EnergyFormat = {
  label: string
  /** Original kWh for tooltip when shown as MWh */
  kwhTooltip?: string
}

/** Energy below 1000 kWh as kWh; larger optionally as MWh with kWh tooltip. */
export function formatEnergyKwh(kwh: number, locale = 'en'): EnergyFormat {
  const v = cleanZero(kwh)
  if (Math.abs(v) < 1000) {
    return {
      label: `${new Intl.NumberFormat(locale, {
        maximumFractionDigits: 1,
        minimumFractionDigits: 0,
      }).format(v)} kWh`,
    }
  }
  const mwh = v / 1000
  const kwhStr = `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(v)} kWh`
  return {
    label: `${new Intl.NumberFormat(locale, {
      maximumFractionDigits: 2,
    }).format(mwh)} MWh`,
    kwhTooltip: kwhStr,
  }
}

export function formatPercent(p: number, locale = 'en'): string {
  const v = cleanZero(p)
  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(v)}%`
}

export function formatAreaM2(m2: number, locale = 'en'): string {
  const v = cleanZero(m2)
  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(v)} m²`
}

/** Length display unit for the panel setup form (store always meters). */
export type LengthDisplayUnit = 'm' | 'mm'

/** Power display unit (store always watts). */
export type PowerDisplayUnit = 'W' | 'kW'

export function mmToM(mm: number): number {
  return mm / 1000
}

export function mToMm(m: number): number {
  return m * 1000
}

export function lengthDisplayToM(
  value: number,
  unit: LengthDisplayUnit,
): number {
  return unit === 'mm' ? mmToM(value) : value
}

export function lengthMToDisplay(
  meters: number,
  unit: LengthDisplayUnit,
): number {
  return unit === 'mm' ? mToMm(meters) : meters
}

export function kwToW(kw: number): number {
  return kw * 1000
}

export function wToKw(w: number): number {
  return w / 1000
}

export function powerDisplayToW(
  value: number,
  unit: PowerDisplayUnit,
): number {
  return unit === 'kW' ? kwToW(value) : value
}

export function powerWToDisplay(watts: number, unit: PowerDisplayUnit): number {
  return unit === 'kW' ? wToKw(watts) : watts
}

/** Round for UI only — never use for placement math. */
export function roundForDisplay(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return 0
  const f = 10 ** decimals
  const r = Math.round(value * f) / f
  return Object.is(r, -0) ? 0 : r
}

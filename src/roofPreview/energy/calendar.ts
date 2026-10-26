/** Month index 0 = January … 11 = December. */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function daysInMonth(year: number, monthIndex: number): number {
  const m = Math.floor(monthIndex)
  if (m < 0 || m > 11) return 30
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (m === 1) return isLeapYear(year) ? 29 : 28
  return lengths[m]!
}

export function averageDailyFromAnnual(annualEnergyKwh: number): number {
  if (!Number.isFinite(annualEnergyKwh) || annualEnergyKwh <= 0) return 0
  return annualEnergyKwh / 365
}

export function averageDailyFromMonth(
  monthEnergyKwh: number,
  year: number,
  monthIndex: number,
): number {
  const days = daysInMonth(year, monthIndex)
  if (!Number.isFinite(monthEnergyKwh) || monthEnergyKwh <= 0 || days <= 0) {
    return 0
  }
  return monthEnergyKwh / days
}

export const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

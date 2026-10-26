import { describe, expect, it } from 'vitest'
import {
  averageDailyFromAnnual,
  averageDailyFromMonth,
  daysInMonth,
  isLeapYear,
} from '../../src/roofPreview/energy/calendar'

describe('calendar', () => {
  it('handles leap-year February', () => {
    expect(isLeapYear(2024)).toBe(true)
    expect(daysInMonth(2024, 1)).toBe(29)
    expect(daysInMonth(2023, 1)).toBe(28)
  })

  it('computes average daily from annual and month', () => {
    expect(averageDailyFromAnnual(3650)).toBe(10)
    expect(averageDailyFromMonth(310, 2023, 0)).toBe(10)
  })
})

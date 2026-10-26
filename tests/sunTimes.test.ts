import { describe, expect, it } from 'vitest'
import {
  getDaylightTimes,
  sampleSunHourMarks,
} from '../src/geo/sunMath'
import { JUNE_21_DOY } from '../src/geo/coordinates'

describe('sun path time labels', () => {
  it('returns sunrise/sunset labels for Mumbai on June 21', () => {
    const t = getDaylightTimes(JUNE_21_DOY, 19.076, 72.8777, 'Asia/Kolkata')
    expect(t.sunriseLabel).toMatch(/^\d{2}:\d{2}$/)
    expect(t.sunsetLabel).toMatch(/^\d{2}:\d{2}$/)
    // June in Mumbai: sunrise before 07:00, sunset after 18:00
    const [sh, sm] = t.sunriseLabel.split(':').map(Number)
    const [eh, em] = t.sunsetLabel.split(':').map(Number)
    expect(sh! * 60 + sm!).toBeLessThan(7 * 60)
    expect(eh! * 60 + em!).toBeGreaterThan(18 * 60)
  })

  it('emits daytime hour marks', () => {
    const marks = sampleSunHourMarks(
      JUNE_21_DOY,
      19.076,
      72.8777,
      'Asia/Kolkata',
    )
    expect(marks.length).toBeGreaterThan(8)
    expect(marks.every((m) => m.sun.isUp)).toBe(true)
    expect(marks.some((m) => m.hour === 12)).toBe(true)
  })
})

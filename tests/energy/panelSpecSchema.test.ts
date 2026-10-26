import { describe, expect, it } from 'vitest'
import {
  formValuesToSpec,
  panelSetupFormSchema,
  powerDensityWarning,
} from '../../src/roofPreview/energy/panelSpecSchema'
import { defaultFormValues } from '../../src/roofPreview/energy/panelSpecSchema'

describe('panelSpecSchema', () => {
  it('accepts defaults', () => {
    const v = defaultFormValues(19)
    const r = panelSetupFormSchema.safeParse(v)
    expect(r.success).toBe(true)
    if (r.success) {
      const spec = formValuesToSpec(r.data)
      expect(spec.widthM).toBeCloseTo(1.134)
      expect(spec.ratedPowerW).toBe(540)
      expect(spec.azimuthDeg).toBe(180)
    }
  })

  it('rejects out-of-range width after mm conversion', () => {
    const v = { ...defaultFormValues(), width: 10, widthUnit: 'mm' as const }
    // 10 mm = 0.01 m — too small
    const r = panelSetupFormSchema.safeParse(v)
    expect(r.success).toBe(false)
  })

  it('rejects NaN', () => {
    const v = { ...defaultFormValues(), tiltDeg: Number.NaN }
    expect(panelSetupFormSchema.safeParse(v).success).toBe(false)
  })

  it('warns on unusual power density but does not block', () => {
    const w = powerDensityWarning({
      widthM: 1,
      heightM: 2,
      ratedPowerW: 50,
      orientation: 'portrait',
      tiltDeg: 15,
      azimuthDeg: 180,
      setbackM: 0.5,
      panelGapM: 0.02,
      rowSpacingM: 0.3,
      moduleType: 'standard',
      systemLossPercent: 14,
      obstacleClearanceM: 0.3,
    })
    expect(w).toBeTruthy()
  })
})

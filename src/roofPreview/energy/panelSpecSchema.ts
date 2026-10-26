import { z } from 'zod'
import type { PanelSpecification } from './types'
import { DEFAULT_PANEL_SPEC } from './types'
import { lengthDisplayToM, powerDisplayToW } from './units'
import type { LengthDisplayUnit, PowerDisplayUnit } from './units'

/** Coerce cleared/empty inputs to fail validation (no silent clamp). */
const finiteNumber = (label: string) =>
  z.preprocess(
    (v) => {
      if (v === '' || v === null || v === undefined) return Number.NaN
      if (typeof v === 'number') return v
      if (typeof v === 'string' && v.trim() !== '') return Number(v)
      return Number.NaN
    },
    z
      .number({ error: `${label} must be a number` })
      .finite(`${label} must be a finite number`),
  )

/** Raw form values before unit conversion (display units). */
export type PanelSetupFormValues = {
  modelName: string
  width: number
  widthUnit: LengthDisplayUnit
  height: number
  heightUnit: LengthDisplayUnit
  ratedPower: number
  powerUnit: PowerDisplayUnit
  orientation: 'portrait' | 'landscape'
  tiltDeg: number
  azimuthDeg: number
  setbackM: number
  panelGapM: number
  rowSpacingM: number
  systemLossPercent: number
  moduleType: 'standard' | 'premium' | 'thin-film'
}

export const panelSetupFormSchema = z
  .object({
    modelName: z
      .string()
      .trim()
      .max(80, 'Model name must be at most 80 characters')
      .default(''),
    width: finiteNumber('Panel width'),
    widthUnit: z.enum(['m', 'mm']),
    height: finiteNumber('Panel height'),
    heightUnit: z.enum(['m', 'mm']),
    ratedPower: finiteNumber('Rated power'),
    powerUnit: z.enum(['W', 'kW']),
    orientation: z.enum(['portrait', 'landscape']),
    tiltDeg: finiteNumber('Tilt'),
    azimuthDeg: finiteNumber('Azimuth'),
    setbackM: finiteNumber('Setback'),
    panelGapM: finiteNumber('Panel gap'),
    rowSpacingM: finiteNumber('Row spacing'),
    systemLossPercent: finiteNumber('System losses'),
    moduleType: z.enum(['standard', 'premium', 'thin-film']),
  })
  .superRefine((data, ctx) => {
    const widthM = lengthDisplayToM(data.width, data.widthUnit)
    const heightM = lengthDisplayToM(data.height, data.heightUnit)
    const ratedPowerW = powerDisplayToW(data.ratedPower, data.powerUnit)

    if (!(data.tiltDeg >= 0 && data.tiltDeg <= 90)) {
      ctx.addIssue({
        code: 'custom',
        path: ['tiltDeg'],
        message: 'Tilt must be 0–90°',
      })
    }
    if (!(data.azimuthDeg >= 0 && data.azimuthDeg < 360)) {
      ctx.addIssue({
        code: 'custom',
        path: ['azimuthDeg'],
        message: 'Azimuth must be 0–359.99°',
      })
    }
    if (!(data.setbackM >= 0 && data.setbackM <= 5)) {
      ctx.addIssue({
        code: 'custom',
        path: ['setbackM'],
        message: 'Setback must be 0–5 m',
      })
    }
    if (!(data.panelGapM >= 0 && data.panelGapM <= 1)) {
      ctx.addIssue({
        code: 'custom',
        path: ['panelGapM'],
        message: 'Gap must be 0–1 m',
      })
    }
    if (!(data.rowSpacingM >= 0 && data.rowSpacingM <= 10)) {
      ctx.addIssue({
        code: 'custom',
        path: ['rowSpacingM'],
        message: 'Row spacing must be 0–10 m',
      })
    }
    if (!(data.systemLossPercent >= 0 && data.systemLossPercent <= 50)) {
      ctx.addIssue({
        code: 'custom',
        path: ['systemLossPercent'],
        message: 'System losses must be 0–50%',
      })
    }
    if (Number.isFinite(widthM) && !(widthM >= 0.3 && widthM <= 3)) {
      ctx.addIssue({
        code: 'custom',
        path: ['width'],
        message: 'Panel width must be between 0.3 m and 3 m',
      })
    }
    if (Number.isFinite(heightM) && !(heightM >= 0.5 && heightM <= 4)) {
      ctx.addIssue({
        code: 'custom',
        path: ['height'],
        message: 'Panel height must be between 0.5 m and 4 m',
      })
    }
    if (
      Number.isFinite(ratedPowerW) &&
      !(ratedPowerW >= 50 && ratedPowerW <= 1000)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['ratedPower'],
        message: 'Rated power must be between 50 W and 1000 W',
      })
    }
    if (
      Number.isFinite(widthM) &&
      Number.isFinite(heightM) &&
      (widthM + data.panelGapM <= 0 || heightM + data.rowSpacingM <= 0)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['panelGapM'],
        message: 'Panel size plus spacing must be physically valid',
      })
    }
  })

export type PanelSetupParsed = z.infer<typeof panelSetupFormSchema>

export function formValuesToSpec(
  data: PanelSetupParsed,
): PanelSpecification {
  const model = (data.modelName ?? '').trim()
  return {
    modelName: model.length > 0 ? model : undefined,
    widthM: lengthDisplayToM(data.width, data.widthUnit),
    heightM: lengthDisplayToM(data.height, data.heightUnit),
    ratedPowerW: powerDisplayToW(data.ratedPower, data.powerUnit),
    // Portrait only — orientation control removed from the setup form
    orientation: 'portrait',
    tiltDeg: data.tiltDeg,
    azimuthDeg: data.azimuthDeg,
    setbackM: data.setbackM,
    panelGapM: data.panelGapM,
    rowSpacingM: data.rowSpacingM,
    moduleType: data.moduleType,
    systemLossPercent: data.systemLossPercent,
    obstacleClearanceM: DEFAULT_PANEL_SPEC.obstacleClearanceM,
  }
}

export function specToFormValues(
  spec: PanelSpecification,
): PanelSetupFormValues {
  return {
    modelName: spec.modelName ?? '',
    width: spec.widthM,
    widthUnit: 'm',
    height: spec.heightM,
    heightUnit: 'm',
    ratedPower: spec.ratedPowerW,
    powerUnit: 'W',
    orientation: spec.orientation,
    tiltDeg: spec.tiltDeg,
    azimuthDeg: spec.azimuthDeg,
    setbackM: spec.setbackM,
    panelGapM: spec.panelGapM,
    rowSpacingM: spec.rowSpacingM,
    systemLossPercent: spec.systemLossPercent,
    moduleType: spec.moduleType,
  }
}

/** Soft warning: unusually high/low W/m² (does not block Apply). */
export function powerDensityWarning(spec: PanelSpecification): string | null {
  const area = spec.widthM * spec.heightM
  if (!(area > 0)) return null
  const wPerM2 = spec.ratedPowerW / area
  if (wPerM2 < 80) {
    return `Rated power looks low for the panel area (~${Math.round(wPerM2)} W/m²). Custom modules are allowed — continue if intentional.`
  }
  if (wPerM2 > 350) {
    return `Rated power looks high for the panel area (~${Math.round(wPerM2)} W/m²). Custom modules are allowed — continue if intentional.`
  }
  return null
}

export function tiltRowSpacingWarning(spec: PanelSpecification): string | null {
  if (spec.tiltDeg > 0 && spec.rowSpacingM === 0) {
    return 'Tilt is greater than 0° but row spacing is 0 — row-to-row shading may increase.'
  }
  return null
}

export function defaultFormValues(
  latitude = 19.076,
): PanelSetupFormValues {
  const azimuthDeg = latitude >= 0 ? 180 : 0
  return specToFormValues({ ...DEFAULT_PANEL_SPEC, azimuthDeg })
}

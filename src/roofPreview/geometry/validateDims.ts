import type { HouseConfig, HouseShape, RoofType } from '../types'
import { supportedRoofTypes } from '../types'

export type ValidationResult =
  | { ok: true }
  | { ok: false; message: string }

function positive(name: string, v: number): ValidationResult {
  if (!(v > 0) || !Number.isFinite(v)) {
    return { ok: false, message: `${name} must be greater than zero.` }
  }
  return { ok: true }
}

export function validateHouseConfig(config: HouseConfig): ValidationResult {
  if (!Number.isInteger(config.floors) || config.floors < 1 || config.floors > 4) {
    return { ok: false, message: 'Floors must be an integer from 1 to 4.' }
  }
  if (config.floorHeightM < 2.7 || config.floorHeightM > 3.6) {
    return {
      ok: false,
      message: 'Floor height must be between 2.7 m and 3.6 m.',
    }
  }
  if (config.overhangM < 0 || !Number.isFinite(config.overhangM)) {
    return { ok: false, message: 'Roof overhang cannot be negative.' }
  }

  const roofOk = validateRoofForShape(config.shape, config.roofType)
  if (!roofOk.ok) return roofOk

  switch (config.shape) {
    case 'rectangle': {
      const a = positive('Length', config.rectangle.lengthM)
      if (!a.ok) return a
      return positive('Width', config.rectangle.widthM)
    }
    case 'l': {
      const d = config.l
      for (const [name, v] of [
        ['Total length', d.totalLengthM],
        ['Total width', d.totalWidthM],
        ['Cut-out length', d.cutoutLengthM],
        ['Cut-out width', d.cutoutWidthM],
      ] as const) {
        const r = positive(name, v)
        if (!r.ok) return r
      }
      if (d.cutoutLengthM >= d.totalLengthM) {
        return {
          ok: false,
          message: 'Cut-out length must be smaller than total length.',
        }
      }
      if (d.cutoutWidthM >= d.totalWidthM) {
        return {
          ok: false,
          message: 'Cut-out width must be smaller than total width.',
        }
      }
      return { ok: true }
    }
    case 'u': {
      const d = config.u
      for (const [name, v] of [
        ['Total length', d.totalLengthM],
        ['Total width', d.totalWidthM],
        ['Cut-out length', d.cutoutLengthM],
        ['Cut-out width', d.cutoutWidthM],
      ] as const) {
        const r = positive(name, v)
        if (!r.ok) return r
      }
      if (d.cutoutLengthM >= d.totalLengthM) {
        return {
          ok: false,
          message: 'Cut-out length must be smaller than total length.',
        }
      }
      if (d.cutoutWidthM >= d.totalWidthM) {
        return {
          ok: false,
          message: 'Cut-out width must be smaller than total width.',
        }
      }
      return { ok: true }
    }
    case 't': {
      const d = config.t
      for (const [name, v] of [
        ['Total length', d.totalLengthM],
        ['Total width', d.totalWidthM],
        ['Stem width', d.stemWidthM],
        ['Crossbar depth', d.crossbarDepthM],
      ] as const) {
        const r = positive(name, v)
        if (!r.ok) return r
      }
      if (d.stemWidthM >= d.totalLengthM) {
        return {
          ok: false,
          message: 'Stem width must be smaller than total length.',
        }
      }
      if (d.crossbarDepthM >= d.totalWidthM) {
        return {
          ok: false,
          message: 'Crossbar depth must be smaller than total width.',
        }
      }
      return { ok: true }
    }
  }
}

export function validateRoofForShape(
  shape: HouseShape,
  roof: RoofType,
): ValidationResult {
  const allowed = supportedRoofTypes(shape)
  if (!allowed.includes(roof)) {
    return {
      ok: false,
      message: `Roof type "${roof}" is not supported for ${shape} shape.`,
    }
  }
  return { ok: true }
}

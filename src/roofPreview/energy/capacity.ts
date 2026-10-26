import type { SolarSystemSummary } from './types'

export function installedCapacityKw(
  panelCount: number,
  ratedPowerW: number,
): number {
  if (!Number.isFinite(panelCount) || !Number.isFinite(ratedPowerW)) return 0
  if (panelCount <= 0 || ratedPowerW <= 0) return 0
  return (panelCount * ratedPowerW) / 1000
}

export function singlePanelAreaM2(widthM: number, heightM: number): number {
  if (!(widthM > 0) || !(heightM > 0)) return 0
  return widthM * heightM
}

export function buildSystemSummary(input: {
  panelCount: number
  widthM: number
  heightM: number
  ratedPowerW: number
  /** Usable roof area after setback (m²). */
  usableRoofAreaM2: number
}): SolarSystemSummary {
  const panelAreaM2 =
    input.panelCount * singlePanelAreaM2(input.widthM, input.heightM)
  const roofCoveragePercent =
    input.usableRoofAreaM2 > 0
      ? Math.min(100, (panelAreaM2 / input.usableRoofAreaM2) * 100)
      : 0
  return {
    panelCount: input.panelCount,
    panelAreaM2,
    roofCoveragePercent,
    installedCapacityKw: installedCapacityKw(
      input.panelCount,
      input.ratedPowerW,
    ),
  }
}

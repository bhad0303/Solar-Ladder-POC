/** Module technology for PVGIS mapping / UI. */
export type ModuleType = 'standard' | 'premium' | 'thin-film'

/**
 * Applied panel specification (store units: meters + watts).
 * Capacity is always derived from panel count × ratedPowerW.
 */
export type PanelSpecification = {
  modelName?: string
  widthM: number
  heightM: number
  ratedPowerW: number
  orientation: 'portrait' | 'landscape'
  tiltDeg: number
  /** Compass degrees: 0 North, 90 East, 180 South, 270 West. Range [0, 360). */
  azimuthDeg: number
  setbackM: number
  panelGapM: number
  rowSpacingM: number
  moduleType: ModuleType
  systemLossPercent: number
  /** Kept from existing POC — clearance around roof obstacles. */
  obstacleClearanceM: number
}

export type SolarSystemSummary = {
  panelCount: number
  panelAreaM2: number
  roofCoveragePercent: number
  installedCapacityKw: number
}

export type EnergyEstimate = {
  source: 'pvgis' | 'nasa-power' | 'fallback'
  calculatedAt: string
  annualEnergyKwh: number
  /** Empty when simple fallback. Length 12 for PVGIS / NASA POWER. */
  monthlyEnergyKwh: number[]
  averageDailyEnergyKwh: number
  selectedMonthEnergyKwh: number
  selectedMonthAverageDailyKwh: number
  capacityFactorPercent?: number
  assumptions: string[]
  warnings: string[]
}

export type EnergyEstimateInput = {
  latitude: number
  longitude: number
  installedCapacityKw: number
  panelTiltDeg: number
  panelAzimuthDeg: number
  systemLossPercent: number
  moduleType: ModuleType
  /** 0 = January … 11 = December */
  selectedMonth: number
  timezone?: string
  peakSunHoursPerDay: number
  /** Calendar year used for Feb/leap day counts */
  year?: number
}

export interface EnergyEstimateProvider {
  estimate(input: EnergyEstimateInput): Promise<EnergyEstimate>
}

export type EstimateStatus = 'idle' | 'loading' | 'ready' | 'error'

export const DEFAULT_LAT = 19.076
export const DEFAULT_LON = 72.8777

export const MAX_PANEL_LAYOUT = 1000

export const DEFAULT_PANEL_SPEC: PanelSpecification = {
  widthM: 1.134,
  heightM: 2.278,
  ratedPowerW: 540,
  orientation: 'portrait',
  tiltDeg: 15,
  azimuthDeg: 180,
  setbackM: 0.5,
  panelGapM: 0.02,
  rowSpacingM: 0.3,
  moduleType: 'standard',
  systemLossPercent: 14,
  obstacleClearanceM: 0.3,
}

export function defaultAzimuthForLatitude(lat: number): number {
  return lat >= 0 ? 180 : 0
}

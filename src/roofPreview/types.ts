/** Length unit for display only — store always holds meters. */
export type LengthUnit = 'm' | 'ft'

export type HouseShape = 'rectangle' | 'l' | 'u' | 't'

export type RoofType = 'flat' | 'gable'

export type CutoutCorner = 'NE' | 'NW' | 'SE' | 'SW'

/** Rectangle dims (meters). Defaults labeled in UI as "default". */
export type RectDims = {
  lengthM: number
  widthM: number
}

/** L-shape: outer box + rectangular cut-out from one corner. */
export type LDims = {
  totalLengthM: number
  totalWidthM: number
  cutoutLengthM: number
  cutoutWidthM: number
  cutoutCorner: CutoutCorner
}

/** U-shape: outer box with a rectangular bite from the south edge (opening faces south). */
export type UDims = {
  totalLengthM: number
  totalWidthM: number
  cutoutLengthM: number
  cutoutWidthM: number
}

/** T-shape: stem from south into a crossbar along the north. */
export type TDims = {
  totalLengthM: number
  totalWidthM: number
  stemWidthM: number
  crossbarDepthM: number
}

export type ShapeDims =
  | { shape: 'rectangle'; dims: RectDims }
  | { shape: 'l'; dims: LDims }
  | { shape: 'u'; dims: UDims }
  | { shape: 't'; dims: TDims }

export type HouseConfig = {
  shape: HouseShape
  rectangle: RectDims
  l: LDims
  u: UDims
  t: TDims
  floors: number
  floorHeightM: number
  roofType: RoofType
  overhangM: number
}

export type PanelOrientation = 'portrait' | 'landscape'

export type ModuleType = 'standard' | 'premium' | 'thin-film'

export type PanelSettings = {
  /** Optional label for the module model */
  modelName?: string
  /** default 1.134 */
  widthM: number
  /** default 2.278 */
  heightM: number
  /** Rated power per panel in W (default 540) */
  watt: number
  /** default 0.5 */
  setbackM: number
  tiltDeg: number
  /** Compass azimuth degrees [0, 360); 0 N, 90 E, 180 S, 270 W */
  azimuthDeg: number
  orientation: PanelOrientation
  /** Gap between panels in a row (default 0.02) */
  panelGapM: number
  /** default 0.3 */
  rowSpacingM: number
  /** default 0.3 — clearance around obstacles for panels */
  obstacleClearanceM: number
  moduleType: ModuleType
  /** System losses percent (default 14) */
  systemLossPercent: number
}

export type RoofPanel = {
  id: string
  position: { x: number; y: number; z: number }
  tiltDeg: number
  azimuthDeg: number
  widthM: number
  heightM: number
  /** True when panel overlaps an obstacle (incl. clearance); not auto-deleted. */
  conflict?: boolean
}

export type {
  ObstacleType,
  RoofObstacle,
} from './geometry/obstacleTypes'

export type FootprintPoint = { x: number; z: number }

export const FT_PER_M = 3.28084

export function mToDisplay(meters: number, unit: LengthUnit): number {
  return unit === 'ft' ? meters * FT_PER_M : meters
}

export function displayToM(value: number, unit: LengthUnit): number {
  return unit === 'ft' ? value / FT_PER_M : value
}

/**
 * Default house config (values labeled "default" in UI).
 * L-shape sized to sit on the red-roof coastal house in
 * welcome-4KG9VicLWQY-unsplash.jpg aerial plan.
 */
export const DEFAULT_HOUSE: HouseConfig = {
  shape: 'l',
  rectangle: { lengthM: 12, widthM: 8 },
  l: {
    totalLengthM: 14,
    totalWidthM: 11,
    cutoutLengthM: 6,
    cutoutWidthM: 4.5,
    cutoutCorner: 'NE',
  },
  u: {
    totalLengthM: 14,
    totalWidthM: 10,
    cutoutLengthM: 6,
    cutoutWidthM: 5,
  },
  t: {
    totalLengthM: 12,
    totalWidthM: 10,
    stemWidthM: 4,
    crossbarDepthM: 4,
  },
  floors: 1,
  floorHeightM: 3.0,
  roofType: 'flat',
  overhangM: 0.25,
}

/** Default panel settings (labeled "default" in UI). */
export const DEFAULT_PANEL_SETTINGS: PanelSettings = {
  widthM: 1.134,
  heightM: 2.278,
  watt: 540,
  setbackM: 0.5,
  tiltDeg: 15,
  azimuthDeg: 180,
  orientation: 'portrait',
  panelGapM: 0.02,
  rowSpacingM: 0.3,
  obstacleClearanceM: 0.3,
  moduleType: 'standard',
  systemLossPercent: 14,
}

export function activeShapeDims(config: HouseConfig): ShapeDims {
  switch (config.shape) {
    case 'rectangle':
      return { shape: 'rectangle', dims: config.rectangle }
    case 'l':
      return { shape: 'l', dims: config.l }
    case 'u':
      return { shape: 'u', dims: config.u }
    case 't':
      return { shape: 't', dims: config.t }
  }
}

export function wallHeightM(config: HouseConfig): number {
  return config.floors * config.floorHeightM
}

/** Which roof types are supported for a given footprint shape. */
export function supportedRoofTypes(_shape: HouseShape): RoofType[] {
  return ['flat', 'gable']
}

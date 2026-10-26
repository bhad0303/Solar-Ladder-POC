/** Local meters: +X east, +Y up, −Z north (before northOffsetDeg). */

export type Vec2 = { x: number; z: number }
export type Vec3 = { x: number; y: number; z: number }

export type ProjectLocation = {
  lat: number
  lon: number
  /** IANA timezone, e.g. Asia/Kolkata — never use the browser timezone. */
  timeZone: string
  northOffsetDeg: number
}

export type ImageryBlock = {
  /** Public URL path, e.g. /assets/site-satellite.jpg */
  file: string
  widthMeters: number
  heightMeters: number
  northUp: boolean
  centerLat: number
  centerLon: number
  rotationDeg: number
}

export type Building = {
  id: string
  /** Closed polygon in local meters (XZ plane), relative to building origin. */
  polygon: Vec2[]
  height: number
  /** Optional wall tint overrides per side (N/E/S/W). */
  wallColors?: Partial<Record<'N' | 'E' | 'S' | 'W', string>>
}

export type RoofItemKind =
  | 'tank'
  | 'mumty'
  | 'vent'
  | 'ac'
  | 'parapet'

export type RoofItem = {
  id: string
  kind: RoofItemKind
  position: Vec3
  /** Kind-specific size hints in meters. */
  widthM?: number
  depthM?: number
  heightM?: number
  radiusM?: number
  rotationDeg?: number
}

export type Panel = {
  id: string
  zoneId: string
  position: Vec3
  tiltDeg: number
  /** Degrees clockwise from north. */
  azimuthDeg: number
  widthM: number
  heightM: number
  ratedPowerW: number
}

export type Zone = {
  id: string
  name: string
  panels: Panel[]
}

export type TreeSpec = {
  id: string
  position: Vec3
  trunkHeightM: number
  trunkRadiusM: number
  canopyRadiusM: number
  canopyHeightM: number
}

export type NeighbourBuilding = {
  id: string
  polygon: Vec2[]
  height: number
}

export type BoundaryWall = {
  /** Closed polyline on ground. */
  points: Vec2[]
  heightM: number
  thicknessM: number
}

export type SolarProject = {
  id: string
  name: string
  subtitle: string
  location: ProjectLocation
  imagery: ImageryBlock
  /** Nudge so the 3D house sits on the roof in the photo. */
  buildingOffsetMeters: Vec2
  building: Building
  roofItems: RoofItem[]
  zones: Zone[]
  trees: TreeSpec[]
  neighbours: NeighbourBuilding[]
  boundaryWall?: BoundaryWall
  /** Optional road strip as a thin ground box. */
  roadStrip?: { center: Vec2; widthM: number; lengthM: number; rotationDeg: number }
}

export type LengthUnit = 'm' | 'ft'

export type PreviewSettings = {
  dayOfYear: number
  minuteOfDay: number
  playing: boolean
  panelInfo: boolean
  sunAccess: boolean
  measurements: boolean
  lengthUnit: LengthUnit
  autoRotate: boolean
  showGrid: boolean
  /** Dev-only calibration nudges (live; copy into project.json). */
  calibration: {
    offsetX: number
    offsetZ: number
    rotationDeg: number
    scale: number
  }
}

/** Flatten zones → panels (totals always derived from this). */
export function allPanels(project: SolarProject): Panel[] {
  return project.zones.flatMap((z) =>
    z.panels.map((p) => ({ ...p, zoneId: z.id })),
  )
}

export function totalRatedKw(project: SolarProject): number {
  return allPanels(project).reduce((s, p) => s + p.ratedPowerW, 0) / 1000
}

export function zoneStats(project: SolarProject): {
  id: string
  name: string
  count: number
  kw: number
}[] {
  return project.zones.map((z) => ({
    id: z.id,
    name: z.name,
    count: z.panels.length,
    kw: z.panels.reduce((s, p) => s + p.ratedPowerW, 0) / 1000,
  }))
}

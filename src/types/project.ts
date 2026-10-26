/** Local meters: +X east, +Y up, +Z north (scene convention for this POC). */

export type LatLng = {
  lat: number
  lng: number
}

export type Vec2 = { x: number; z: number }

export type DataQuality = 'osm' | 'estimated' | 'not_found' | 'manual'

export type FootprintSource = 'overpass' | 'manual_draw' | 'manual_box' | null

export type BuildingFootprint = {
  /** Closed ring in local meters (first ≠ last duplicate optional; cleaned later). */
  polygonLocal: Vec2[]
  /** Same ring in WGS84 for map overlay. */
  polygonLatLng: LatLng[]
  centroid: LatLng
  /** Roof / footprint plan area from OSM outline (shoelace, m²). */
  areaM2: number
  /** OSM way/relation id when known. */
  osmId: string | null
  tags: {
    building?: string
    levels?: number | null
    heightM?: number | null
    roofShape?: string | null
  }
  /** How we chose this building. */
  selection: 'contains' | 'nearest' | 'manual'
  source: FootprintSource
  quality: {
    footprint: DataQuality
    height: DataQuality
    roof: DataQuality
  }
}

export type ProjectLocation = {
  lat: number
  lng: number
  /** Set after Find house; used for sun math later. */
  timeZone: string | null
}

/** Step 1+ project shell — later steps fill footprint / panels / scene. */
export type SolarRoofProject = {
  location: ProjectLocation
  footprint: BuildingFootprint | null
  statusMessage: string | null
  error: string | null
}

export function isValidLat(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90
}

export function isValidLng(lng: number): boolean {
  return Number.isFinite(lng) && lng >= -180 && lng <= 180
}

export function isValidLatLng(lat: number, lng: number): boolean {
  return isValidLat(lat) && isValidLng(lng)
}

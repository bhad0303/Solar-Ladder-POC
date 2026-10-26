import type { Vec2 } from '../types/project'
import { pointInPolygonLatLng } from '../osm/polygonMath'

/** Local-meter point-in-polygon (same ray cast as lat/lng helper). */
export function pointInPolygonLocal(point: Vec2, ring: Vec2[]): boolean {
  // Reuse lat/lng algorithm by mapping x→lng, z→lat
  return pointInPolygonLatLng(
    { lat: point.z, lng: point.x },
    ring.map((p) => ({ lat: p.z, lng: p.x })),
  )
}

export type RoofPanelSpec = {
  id: string
  x: number
  y: number
  z: number
  widthM: number
  heightM: number
  tiltDeg: number
  /** Degrees clockwise from north. */
  azimuthDeg: number
}

export type LayoutOptions = {
  panelWidthM?: number
  panelHeightM?: number
  gapM?: number
  edgeInsetM?: number
  tiltDeg?: number
  /** India / northern hemisphere default: face south. */
  azimuthDeg?: number
  roofClearanceM?: number
}

/**
 * Pack a regular grid of panels on the footprint polygon (plan view).
 * Only keeps modules whose footprint corners sit inside the OSM outline.
 */
export function layoutPanelsOnPolygon(
  polygonLocal: Vec2[],
  roofY: number,
  opts: LayoutOptions = {},
): RoofPanelSpec[] {
  if (polygonLocal.length < 3) return []

  const panelW = opts.panelWidthM ?? 1.65
  const panelH = opts.panelHeightM ?? 1.0
  const gap = opts.gapM ?? 0.12
  const inset = opts.edgeInsetM ?? 0.45
  const tilt = opts.tiltDeg ?? 18
  const azimuth = opts.azimuthDeg ?? 180
  const clearance = opts.roofClearanceM ?? 0.22

  const xs = polygonLocal.map((p) => p.x)
  const zs = polygonLocal.map((p) => p.z)
  const minX = Math.min(...xs) + inset
  const maxX = Math.max(...xs) - inset
  const minZ = Math.min(...zs) + inset
  const maxZ = Math.max(...zs) - inset

  if (maxX - minX < panelW || maxZ - minZ < panelH) return []

  const stepX = panelW + gap
  const stepZ = panelH + gap
  const panels: RoofPanelSpec[] = []
  let i = 0

  for (let x = minX + panelW / 2; x + panelW / 2 <= maxX + 1e-6; x += stepX) {
    for (let z = minZ + panelH / 2; z + panelH / 2 <= maxZ + 1e-6; z += stepZ) {
      const corners: Vec2[] = [
        { x: x - panelW / 2, z: z - panelH / 2 },
        { x: x + panelW / 2, z: z - panelH / 2 },
        { x: x + panelW / 2, z: z + panelH / 2 },
        { x: x - panelW / 2, z: z + panelH / 2 },
      ]
      if (!corners.every((c) => pointInPolygonLocal(c, polygonLocal))) continue
      panels.push({
        id: `p-${i++}`,
        x,
        y: roofY + clearance,
        z,
        widthM: panelW,
        heightM: panelH,
        tiltDeg: tilt,
        azimuthDeg: azimuth,
      })
    }
  }

  return panels
}

import type { FootprintPoint } from '../types'

/** Signed area in XZ (positive = CCW when +Y up, looking down). */
export function signedArea(poly: FootprintPoint[]): number {
  let a = 0
  const n = poly.length
  for (let i = 0; i < n; i++) {
    const p = poly[i]!
    const q = poly[(i + 1) % n]!
    a += p.x * q.z - q.x * p.z
  }
  return a / 2
}

export function ensureCcw(poly: FootprintPoint[]): FootprintPoint[] {
  if (poly.length < 3) return poly.slice()
  if (signedArea(poly) < 0) return poly.slice().reverse()
  return poly.slice()
}

/** Drop consecutive duplicates and a closing point that matches the first. */
export function cleanRing(poly: FootprintPoint[], eps = 1e-9): FootprintPoint[] {
  if (poly.length === 0) return []
  const out: FootprintPoint[] = []
  for (const p of poly) {
    const last = out[out.length - 1]
    if (last && Math.hypot(p.x - last.x, p.z - last.z) < eps) continue
    out.push({ x: p.x, z: p.z })
  }
  if (out.length >= 2) {
    const first = out[0]!
    const last = out[out.length - 1]!
    if (Math.hypot(first.x - last.x, first.z - last.z) < eps) out.pop()
  }
  return out
}

export function pointInPolygon(
  point: FootprintPoint,
  poly: FootprintPoint[],
): boolean {
  const n = poly.length
  if (n < 3) return false
  let inside = false
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const pi = poly[i]!
    const pj = poly[j]!
    const intersect =
      pi.z > point.z !== pj.z > point.z &&
      point.x <
        ((pj.x - pi.x) * (point.z - pi.z)) / (pj.z - pi.z + Number.EPSILON) +
          pi.x
    if (intersect) inside = !inside
  }
  return inside
}

/**
 * Inset polygon by setbackM (meters) using edge normals.
 * Works best for convex / near-rectilinear footprints (our shapes).
 */
export function insetPolygon(
  poly: FootprintPoint[],
  setbackM: number,
): FootprintPoint[] | null {
  const ring = ensureCcw(cleanRing(poly))
  const n = ring.length
  if (n < 3 || setbackM < 0) return null
  if (setbackM === 0) return ring.map((p) => ({ ...p }))

  const result: FootprintPoint[] = []
  for (let i = 0; i < n; i++) {
    const prev = ring[(i - 1 + n) % n]!
    const curr = ring[i]!
    const next = ring[(i + 1) % n]!

    const e1x = curr.x - prev.x
    const e1z = curr.z - prev.z
    const len1 = Math.hypot(e1x, e1z) || 1
    // Inward normal for CCW: rotate edge 90° CW → (+z, -x) wait:
    // CCW edge (dx,dz), left normal (inward for CCW when looking down +Y) is (-dz, dx)
    const n1x = -e1z / len1
    const n1z = e1x / len1

    const e2x = next.x - curr.x
    const e2z = next.z - curr.z
    const len2 = Math.hypot(e2x, e2z) || 1
    const n2x = -e2z / len2
    const n2z = e2x / len2

    // Offset both edges inward and intersect
    const a1x = prev.x + n1x * setbackM
    const a1z = prev.z + n1z * setbackM
    const a2x = curr.x + n1x * setbackM
    const a2z = curr.z + n1z * setbackM

    const b1x = curr.x + n2x * setbackM
    const b1z = curr.z + n2z * setbackM
    const b2x = next.x + n2x * setbackM
    const b2z = next.z + n2z * setbackM

    const hit = lineIntersect(a1x, a1z, a2x, a2z, b1x, b1z, b2x, b2z)
    if (!hit) return null
    result.push(hit)
  }

  const cleaned = cleanRing(result)
  if (cleaned.length < 3) return null
  const area = signedArea(cleaned)
  // Collapsed or inverted inset → unusable
  if (area <= 1e-3) return null
  const outerArea = Math.abs(signedArea(ring))
  if (area > outerArea * 1.01) return null
  return ensureCcw(cleaned)
}

function lineIntersect(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  x3: number,
  z3: number,
  x4: number,
  z4: number,
): FootprintPoint | null {
  const den = (x1 - x2) * (z3 - z4) - (z1 - z2) * (x3 - x4)
  if (Math.abs(den) < 1e-12) return null
  const t = ((x1 - x3) * (z3 - z4) - (z1 - z3) * (x3 - x4)) / den
  return {
    x: x1 + t * (x2 - x1),
    z: z1 + t * (z2 - z1),
  }
}

export function bounds(poly: FootprintPoint[]): {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
} {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const p of poly) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minZ = Math.min(minZ, p.z)
    maxZ = Math.max(maxZ, p.z)
  }
  return { minX, maxX, minZ, maxZ }
}

/** Longest edge direction (unit vector in XZ) and length. */
export function longestEdge(poly: FootprintPoint[]): {
  dx: number
  dz: number
  length: number
  i: number
} {
  const ring = cleanRing(poly)
  let best = { dx: 1, dz: 0, length: 0, i: 0 }
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!
    const b = ring[(i + 1) % ring.length]!
    const dx = b.x - a.x
    const dz = b.z - a.z
    const length = Math.hypot(dx, dz)
    if (length > best.length) best = { dx, dz, length, i }
  }
  const inv = best.length || 1
  return {
    dx: best.dx / inv,
    dz: best.dz / inv,
    length: best.length,
    i: best.i,
  }
}

/** Axis-aligned rectangle corners of a panel centered at (cx,cz) with size w×d and yaw. */
export function panelCorners(
  cx: number,
  cz: number,
  widthM: number,
  depthM: number,
  yawRad: number,
): FootprintPoint[] {
  const hx = widthM / 2
  const hz = depthM / 2
  const local: FootprintPoint[] = [
    { x: -hx, z: -hz },
    { x: hx, z: -hz },
    { x: hx, z: hz },
    { x: -hx, z: hz },
  ]
  const c = Math.cos(yawRad)
  const s = Math.sin(yawRad)
  return local.map((p) => ({
    x: cx + p.x * c + p.z * s,
    z: cz - p.x * s + p.z * c,
  }))
}

export function polygonContainsPolygon(
  outer: FootprintPoint[],
  inner: FootprintPoint[],
): boolean {
  return inner.every((p) => pointInPolygon(p, outer))
}

/** Rough AABB overlap of two polygons. */
export function polygonsAabbOverlap(
  a: FootprintPoint[],
  b: FootprintPoint[],
): boolean {
  const A = bounds(a)
  const B = bounds(b)
  return !(
    A.maxX < B.minX ||
    A.minX > B.maxX ||
    A.maxZ < B.minZ ||
    A.minZ > B.maxZ
  )
}

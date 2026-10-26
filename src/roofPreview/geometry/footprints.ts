import type {
  FootprintPoint,
  LDims,
  RectDims,
  ShapeDims,
  TDims,
  UDims,
} from '../types'
import { cleanRing, ensureCcw } from './polygon'

/** Outer rectangle centered on origin, length along +X, width along +Z. */
export function footprintRectangle(dims: RectDims): FootprintPoint[] {
  const hx = dims.lengthM / 2
  const hz = dims.widthM / 2
  return ensureCcw(
    cleanRing([
      { x: -hx, z: -hz },
      { x: hx, z: -hz },
      { x: hx, z: hz },
      { x: -hx, z: hz },
    ]),
  )
}

/**
 * L-shape = outer rectangle minus a rectangular cut-out at one corner.
 * Vertices listed CCW without duplicate close.
 */
export function footprintL(dims: LDims): FootprintPoint[] {
  const hx = dims.totalLengthM / 2
  const hz = dims.totalWidthM / 2
  const cl = dims.cutoutLengthM
  const cw = dims.cutoutWidthM

  // Outer corners: SW, SE, NE, NW
  // Cut-out removes a corner — walk the L boundary CCW
  let poly: FootprintPoint[]
  switch (dims.cutoutCorner) {
    case 'NE':
      // Missing NE: SW → SE → (SE+cut along N) → inner → (NW+cut along E) → NW
      poly = [
        { x: -hx, z: -hz },
        { x: hx, z: -hz },
        { x: hx, z: hz - cw },
        { x: hx - cl, z: hz - cw },
        { x: hx - cl, z: hz },
        { x: -hx, z: hz },
      ]
      break
    case 'NW':
      poly = [
        { x: -hx, z: -hz },
        { x: hx, z: -hz },
        { x: hx, z: hz },
        { x: -hx + cl, z: hz },
        { x: -hx + cl, z: hz - cw },
        { x: -hx, z: hz - cw },
      ]
      break
    case 'SE':
      poly = [
        { x: -hx, z: -hz },
        { x: hx - cl, z: -hz },
        { x: hx - cl, z: -hz + cw },
        { x: hx, z: -hz + cw },
        { x: hx, z: hz },
        { x: -hx, z: hz },
      ]
      break
    case 'SW':
      poly = [
        { x: -hx + cl, z: -hz },
        { x: hx, z: -hz },
        { x: hx, z: hz },
        { x: -hx, z: hz },
        { x: -hx, z: -hz + cw },
        { x: -hx + cl, z: -hz + cw },
      ]
      break
  }
  return ensureCcw(cleanRing(poly))
}

/** U-shape: opening faces south (−Z); cutout centered on south edge. */
export function footprintU(dims: UDims): FootprintPoint[] {
  const hx = dims.totalLengthM / 2
  const hz = dims.totalWidthM / 2
  const cl = dims.cutoutLengthM
  const cw = dims.cutoutWidthM
  const ix = cl / 2
  const poly: FootprintPoint[] = [
    { x: -hx, z: -hz },
    { x: -ix, z: -hz },
    { x: -ix, z: -hz + cw },
    { x: ix, z: -hz + cw },
    { x: ix, z: -hz },
    { x: hx, z: -hz },
    { x: hx, z: hz },
    { x: -hx, z: hz },
  ]
  return ensureCcw(cleanRing(poly))
}

/**
 * T-shape: crossbar along north (+Z), stem centered along X extending south.
 * totalLength = full crossbar X; totalWidth = full north–south extent;
 * stemWidth = stem thickness in X; crossbarDepth = north arm depth in Z.
 */
export function footprintT(dims: TDims): FootprintPoint[] {
  const hx = dims.totalLengthM / 2
  const hz = dims.totalWidthM / 2
  const sw = dims.stemWidthM / 2
  const cd = dims.crossbarDepthM
  const stemTopZ = hz - cd
  const poly: FootprintPoint[] = [
    { x: -sw, z: -hz },
    { x: sw, z: -hz },
    { x: sw, z: stemTopZ },
    { x: hx, z: stemTopZ },
    { x: hx, z: hz },
    { x: -hx, z: hz },
    { x: -hx, z: stemTopZ },
    { x: -sw, z: stemTopZ },
  ]
  return ensureCcw(cleanRing(poly))
}

export function footprintFromShape(shape: ShapeDims): FootprintPoint[] {
  switch (shape.shape) {
    case 'rectangle':
      return footprintRectangle(shape.dims)
    case 'l':
      return footprintL(shape.dims)
    case 'u':
      return footprintU(shape.dims)
    case 't':
      return footprintT(shape.dims)
  }
}

/** Split concave footprints into axis-aligned rectangles for sloped roofs. */
export function rectangularSections(shape: ShapeDims): FootprintPoint[][] {
  switch (shape.shape) {
    case 'rectangle':
      return [footprintRectangle(shape.dims)]
    case 'l': {
      const d = shape.dims
      const hx = d.totalLengthM / 2
      const hz = d.totalWidthM / 2
      const cl = d.cutoutLengthM
      const cw = d.cutoutWidthM
      // Two rectangles covering the L (union without overlap interiors)
      if (d.cutoutCorner === 'NE') {
        return [
          footprintRectangleFromBounds(-hx, hx, -hz, hz - cw),
          footprintRectangleFromBounds(-hx, hx - cl, hz - cw, hz),
        ]
      }
      if (d.cutoutCorner === 'NW') {
        return [
          footprintRectangleFromBounds(-hx, hx, -hz, hz - cw),
          footprintRectangleFromBounds(-hx + cl, hx, hz - cw, hz),
        ]
      }
      if (d.cutoutCorner === 'SE') {
        return [
          footprintRectangleFromBounds(-hx, hx - cl, -hz, hz),
          footprintRectangleFromBounds(hx - cl, hx, -hz + cw, hz),
        ]
      }
      // SW
      return [
        footprintRectangleFromBounds(-hx + cl, hx, -hz, hz),
        footprintRectangleFromBounds(-hx, -hx + cl, -hz + cw, hz),
      ]
    }
    case 'u': {
      const d = shape.dims
      const hx = d.totalLengthM / 2
      const hz = d.totalWidthM / 2
      const cl = d.cutoutLengthM
      const cw = d.cutoutWidthM
      const ix = cl / 2
      return [
        footprintRectangleFromBounds(-hx, -ix, -hz, hz),
        footprintRectangleFromBounds(ix, hx, -hz, hz),
        footprintRectangleFromBounds(-ix, ix, -hz + cw, hz),
      ]
    }
    case 't': {
      const d = shape.dims
      const hx = d.totalLengthM / 2
      const hz = d.totalWidthM / 2
      const sw = d.stemWidthM / 2
      const cd = d.crossbarDepthM
      return [
        footprintRectangleFromBounds(-hx, hx, hz - cd, hz),
        footprintRectangleFromBounds(-sw, sw, -hz, hz - cd),
      ]
    }
  }
}

function footprintRectangleFromBounds(
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): FootprintPoint[] {
  return ensureCcw(
    cleanRing([
      { x: minX, z: minZ },
      { x: maxX, z: minZ },
      { x: maxX, z: maxZ },
      { x: minX, z: maxZ },
    ]),
  )
}

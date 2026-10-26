import { describe, expect, it } from 'vitest'
import {
  footprintFromShape,
  footprintRectangle,
} from '../src/roofPreview/geometry/footprints'
import {
  createObstacleFromPreset,
  type RoofObstacle,
} from '../src/roofPreview/geometry/obstacleTypes'
import {
  findFreeObstacleSlot,
  panelOverlapsObstacle,
  panelsConflictingWithObstacles,
  validateObstaclePlacement,
} from '../src/roofPreview/geometry/obstacleValidator'
import {
  autoFillBySections,
  validatePanelPlacement,
} from '../src/roofPreview/geometry/panelValidator'
import {
  DEFAULT_PANEL_SETTINGS,
  type RoofPanel,
} from '../src/roofPreview/types'

describe('validateObstaclePlacement', () => {
  const roof = footprintRectangle({ lengthM: 12, widthM: 8 })

  it('accepts a tank inside the setback', () => {
    const o = createObstacleFromPreset('water_tank', 0, 3, 0)
    const r = validateObstaclePlacement(roof, 0.35, o, [])
    expect(r.ok).toBe(true)
  })

  it('rejects an obstacle outside the roof', () => {
    const o = createObstacleFromPreset('chimney', 40, 3, 0)
    const r = validateObstaclePlacement(roof, 0.35, o, [])
    expect(r.ok).toBe(false)
  })

  it('rejects overlapping obstacles with a clear message', () => {
    const a = createObstacleFromPreset('ac_unit', 0, 3, 0, 'a')
    const b = createObstacleFromPreset('ac_unit', 0.2, 3, 0.1, 'b')
    const r = validateObstaclePlacement(roof, 0.35, b, [a])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/overlaps another obstacle/i)
  })
})

describe('findFreeObstacleSlot (L / U edge cases)', () => {
  it('places on L-shape roof solid area, not the cutout centroid', () => {
    const shape = {
      shape: 'l' as const,
      dims: {
        totalLengthM: 14,
        totalWidthM: 11,
        cutoutLengthM: 6,
        cutoutWidthM: 4.5,
        cutoutCorner: 'NE' as const,
      },
    }
    const roof = footprintFromShape(shape)
    const slot = findFreeObstacleSlot(
      'water_tank',
      roof,
      shape,
      0.35,
      [],
      3,
    )
    expect(slot.ok).toBe(true)
    if (!slot.ok) return
    // Cutout for NE is roughly x>1, z>1 (outer NE removed) — tank must be inside roof
    const check = validateObstaclePlacement(
      roof,
      0.35,
      slot.obstacle,
      [],
    )
    expect(check.ok).toBe(true)
  })

  it('places a second obstacle without overlapping the first', () => {
    const shape = {
      shape: 'u' as const,
      dims: {
        totalLengthM: 14,
        totalWidthM: 10,
        cutoutLengthM: 6,
        cutoutWidthM: 5,
      },
    }
    const roof = footprintFromShape(shape)
    const first = findFreeObstacleSlot(
      'water_tank',
      roof,
      shape,
      0.35,
      [],
      3,
    )
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const second = findFreeObstacleSlot(
      'ac_unit',
      roof,
      shape,
      0.35,
      [first.obstacle],
      3,
    )
    expect(second.ok).toBe(true)
    if (!second.ok) return
    const check = validateObstaclePlacement(
      roof,
      0.35,
      second.obstacle,
      [first.obstacle],
    )
    expect(check.ok).toBe(true)
  })

  it('returns overlap reason when roof is full of obstacles', () => {
    const shape = {
      shape: 'rectangle' as const,
      dims: { lengthM: 4, widthM: 3 },
    }
    const roof = footprintFromShape(shape)
    const existing: RoofObstacle[] = []
    // Pack many chimneys until no room
    for (let i = 0; i < 40; i++) {
      const s = findFreeObstacleSlot(
        'chimney',
        roof,
        shape,
        0.2,
        existing,
        3,
      )
      if (!s.ok) {
        expect(s.reason.length).toBeGreaterThan(0)
        return
      }
      existing.push(s.obstacle)
    }
    const last = findFreeObstacleSlot('stair_room', roof, shape, 0.2, existing, 3)
    expect(last.ok).toBe(false)
  })
})

describe('panel ↔ obstacle clearance', () => {
  it('detects overlap including default clearance', () => {
    const tank = createObstacleFromPreset('water_tank', 0, 3, 0)
    const hits = panelOverlapsObstacle(
      { x: 0.9, z: 0, widthM: 1.134, heightM: 2.278, yawRad: 0 },
      tank,
      0.3,
    )
    expect(hits).toBe(true)
  })

  it('marks conflicting panels without removing them', () => {
    const tank = createObstacleFromPreset('water_tank', 0, 3, 0)
    const panels: RoofPanel[] = [
      {
        id: 'p1',
        position: { x: 0, y: 3, z: 0 },
        tiltDeg: 18,
        azimuthDeg: 0,
        widthM: 1.134,
        heightM: 2.278,
      },
      {
        id: 'p2',
        position: { x: 4, y: 3, z: 0 },
        tiltDeg: 18,
        azimuthDeg: 0,
        widthM: 1.134,
        heightM: 2.278,
      },
    ]
    const marked = panelsConflictingWithObstacles(panels, [tank], 0.3)
    expect(marked).toHaveLength(2)
    expect(marked[0]!.conflict).toBe(true)
    expect(marked[1]!.conflict).toBe(false)
  })
})

describe('autoFillBySections avoids obstacles', () => {
  it('places fewer panels when a large stair blocks the roof', () => {
    const shape = {
      shape: 'rectangle' as const,
      dims: { lengthM: 12, widthM: 8 },
    }
    const roof = footprintRectangle(shape.dims)
    const settings = { ...DEFAULT_PANEL_SETTINGS, obstacleClearanceM: 0.3 }
    const free = autoFillBySections(shape, roof, settings, 3.1, {
      gable: false,
    })
    const stair: RoofObstacle = {
      id: 'stair-1',
      type: 'stair_room',
      position: { x: 0, y: 3, z: 0 },
      widthM: 4,
      depthM: 4,
      heightM: 2.4,
      yawRad: 0,
    }
    const blocked = autoFillBySections(shape, roof, settings, 3.1, {
      gable: false,
      obstacles: [stair],
    })
    expect(free.length).toBeGreaterThan(0)
    expect(blocked.length).toBeLessThan(free.length)

    for (const p of blocked) {
      const r = validatePanelPlacement(
        roof,
        settings.setbackM,
        {
          x: p.position.x,
          z: p.position.z,
          widthM: p.widthM,
          heightM: p.heightM,
          yawRad: 0,
        },
        [],
        undefined,
        { obstacles: [stair], clearanceM: 0.3 },
      )
      expect(r.ok).toBe(true)
    }
  })
})

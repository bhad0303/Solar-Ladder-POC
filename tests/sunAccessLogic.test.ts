import { describe, expect, it } from 'vitest'
import {
  computeSunAccess,
  type SerializableMesh,
} from '../src/sunAccess/sunAccessLogic'
import type { Panel, ProjectLocation } from '../src/data/types'
import { JUNE_21_DOY } from '../src/geo/coordinates'

const location: ProjectLocation = {
  lat: 19.076,
  lon: 72.8777,
  timeZone: 'Asia/Kolkata',
  northOffsetDeg: 0,
}

const panel: Panel = {
  id: 'p1',
  zoneId: 'zone-1',
  widthM: 1.7,
  heightM: 1,
  ratedPowerW: 540,
  tiltDeg: 15,
  azimuthDeg: 180,
  position: { x: 0, y: 3.2, z: 0 },
}

describe('sunAccessLogic', () => {
  it('gives higher access with no occluders than with a blocking box', () => {
    const clear = computeSunAccess({
      panels: [panel],
      occluders: [],
      location,
      dayOfYear: JUNE_21_DOY,
      stepMinutes: 60,
    })
    const wall: SerializableMesh = {
      id: 'wall',
      min: { x: -2, y: 0, z: -8 },
      max: { x: 2, y: 20, z: -1 },
    }
    const blocked = computeSunAccess({
      panels: [panel],
      occluders: [wall],
      location,
      dayOfYear: JUNE_21_DOY,
      stepMinutes: 60,
    })
    expect(clear[0]!.accessRatio).toBeGreaterThan(0)
    expect(blocked[0]!.accessRatio).toBeLessThanOrEqual(clear[0]!.accessRatio)
  })
})

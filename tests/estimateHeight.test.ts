import { describe, expect, it } from 'vitest'
import { estimateBuildingHeightM } from '../src/babylon/buildFootprintHouse'
import type { BuildingFootprint } from '../src/types/project'

function stub(partial: Partial<BuildingFootprint> & { tags: BuildingFootprint['tags'] }): BuildingFootprint {
  return {
    polygonLocal: [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      { x: 10, z: 10 },
      { x: 0, z: 10 },
    ],
    polygonLatLng: [],
    centroid: { lat: 0, lng: 0 },
    areaM2: 100,
    osmId: null,
    selection: 'contains',
    source: 'overpass',
    quality: { footprint: 'osm', height: 'estimated', roof: 'estimated' },
    ...partial,
  }
}

describe('estimateBuildingHeightM', () => {
  it('uses explicit height', () => {
    expect(
      estimateBuildingHeightM(stub({ tags: { heightM: 12, levels: 2 } })),
    ).toBe(12)
  })

  it('uses levels × 3', () => {
    expect(estimateBuildingHeightM(stub({ tags: { levels: 4 } }))).toBe(12)
  })

  it('defaults hospital to mid-rise', () => {
    expect(
      estimateBuildingHeightM(stub({ tags: { building: 'hospital' } })),
    ).toBe(6.5)
  })
})

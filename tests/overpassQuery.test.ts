import { describe, expect, it } from 'vitest'
import {
  buildAroundQuery,
  buildIsInQuery,
  cacheKey,
} from '../src/osm/overpass'

describe('overpass queries', () => {
  it('builds is_in query for accurate contains lookup', () => {
    const q = buildIsInQuery(19.076, 72.878)
    expect(q).toContain('is_in(19.076,72.878)')
    expect(q).toContain('way(pivot.a)["building"]')
    expect(q).toContain('timeout:8')
  })

  it('builds tight around query as fallback', () => {
    const q = buildAroundQuery(19.076, 72.878, 25)
    expect(q).toContain('around:25,19.076,72.878')
  })

  it('rounds cache keys to ~1 m grid', () => {
    expect(cacheKey({ lat: 19.076231, lng: 72.878009 })).toBe(
      cacheKey({ lat: 19.076229, lng: 72.878011 }),
    )
  })
})

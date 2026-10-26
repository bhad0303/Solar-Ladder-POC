import { describe, expect, it } from 'vitest'
import { LocalImageProvider } from '../src/imagery/LocalImageProvider'
import type { ImageryBlock } from '../src/data/types'

describe('LocalImageProvider', () => {
  it('resolves absolute and relative file paths under public/', () => {
    const p = new LocalImageProvider()
    const abs: ImageryBlock = {
      file: '/assets/site-satellite.jpg',
      widthMeters: 80,
      heightMeters: 80,
      northUp: true,
      centerLat: 0,
      centerLon: 0,
      rotationDeg: 0,
    }
    expect(p.resolveUrl(abs)).toBe('/assets/site-satellite.jpg')
    expect(
      p.resolveUrl({ ...abs, file: 'assets/site-satellite.jpg' }),
    ).toBe('/assets/site-satellite.jpg')
  })
})

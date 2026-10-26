import { describe, expect, it } from 'vitest'
import {
  parseOsmMapXml,
  pinToBBox,
} from '../src/osm/osmMapApi'

describe('osmMapApi', () => {
  it('builds a tight bbox around the pin', () => {
    const box = pinToBBox({ lat: 19.076, lng: 72.878 }, 30)
    expect(box.south).toBeLessThan(19.076)
    expect(box.north).toBeGreaterThan(19.076)
    expect(box.west).toBeLessThan(72.878)
    expect(box.east).toBeGreaterThan(72.878)
    expect(box.north - box.south).toBeLessThan(0.001)
  })

  it('parses building ways from OSM XML', () => {
    const xml = `<?xml version="1.0"?>
<osm>
  <node id="1" lat="19.0" lon="72.0"/>
  <node id="2" lat="19.0" lon="72.001"/>
  <node id="3" lat="19.001" lon="72.001"/>
  <node id="4" lat="19.001" lon="72.0"/>
  <way id="99">
    <nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/>
    <tag k="building" v="yes"/>
  </way>
  <way id="100">
    <nd ref="1"/><nd ref="2"/>
    <tag k="highway" v="service"/>
  </way>
</osm>`
    const ways = parseOsmMapXml(xml)
    expect(ways).toHaveLength(1)
    expect(ways[0]!.id).toBe(99)
    expect(ways[0]!.tags?.building).toBe('yes')
    expect(ways[0]!.geometry!.length).toBeGreaterThanOrEqual(4)
  })
})

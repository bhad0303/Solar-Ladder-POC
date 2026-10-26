import { describe, expect, it } from 'vitest'
import { formatEnergyKwh, formatKw } from '../../src/roofPreview/energy/format'

describe('format', () => {
  it('formats kW with at most 2 decimals', () => {
    expect(formatKw(8.1)).toContain('8.1')
    expect(formatKw(8.1234)).toContain('8.12')
  })

  it('uses MWh for large energy with kWh tooltip', () => {
    const f = formatEnergyKwh(12_500)
    expect(f.label).toContain('MWh')
    expect(f.kwhTooltip).toContain('kWh')
  })

  it('keeps small energy as kWh', () => {
    expect(formatEnergyKwh(31.35).label).toContain('kWh')
  })
})

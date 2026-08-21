import { describe, expect, it } from 'vitest'
import { isInventoryLine, normalizeRepairLineType } from './line-types'

describe('repair line types', () => {
  it('keeps legacy and unknown rows as separately charged parts', () => {
    expect(normalizeRepairLineType(undefined)).toBe('charged_part')
    expect(normalizeRepairLineType('unknown')).toBe('charged_part')
  })

  it('recognizes the closed set of current line types', () => {
    expect(normalizeRepairLineType('service')).toBe('service')
    expect(normalizeRepairLineType('included_material')).toBe('included_material')
    expect(normalizeRepairLineType('charged_part')).toBe('charged_part')
  })

  it('never treats a service as a stock-consuming line', () => {
    expect(isInventoryLine('service')).toBe(false)
    expect(isInventoryLine('included_material')).toBe(true)
    expect(isInventoryLine('charged_part')).toBe(true)
  })
})

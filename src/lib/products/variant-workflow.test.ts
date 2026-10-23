import { describe, expect, it } from 'vitest'
import { countVariantCombinations, validateVariantAttributes, VARIANT_COMBINATION_HARD_CAP, VARIANT_COMBINATION_WARNING_THRESHOLD } from './variant-workflow'

describe('variant workflow', () => {
  it('counts canonical normalized options without duplicate values', () => {
    expect(countVariantCombinations([{ key: 'color', options: [' Negro ', 'negro', 'Ｎｅｇｒｏ', 'Blanco', ''] }, { key: 'size', options: ['S', 'M'] }])).toBe(4)
  })
  it('requires every attribute to have options', () => {
    expect(countVariantCombinations([])).toBe(0)
    expect(countVariantCombinations([{ key: 'a', options: ['A'] }, { key: 'b', options: [] }])).toBe(0)
  })
  it('counts an enormous product without Cartesian materialization', () => {
    expect(countVariantCombinations(Array.from({ length: 20 }, (_, i) => ({ key: `a${i}`, options: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] })))).toBe(Number.MAX_SAFE_INTEGER)
  })
  it('validates canonical duplicate labels, keys and values', () => {
    const errors = validateVariantAttributes([{ key: 'a', label: ' Color ', control: 'select', options: ['Negro', ' negro '] }, { key: 'Ａ', label: 'color', control: 'select', options: [] }])
    expect(errors.join(' ')).toContain('duplicado')
    expect(errors.join(' ')).toContain('clave única')
    expect(errors.join(' ')).toContain('al menos un valor')
  })
  it('accepts valid attributes and exposes explicit size thresholds', () => {
    expect(validateVariantAttributes([{ key: 'color', label: 'Color', control: 'select', options: ['Negro'] }])).toEqual([])
    expect(VARIANT_COMBINATION_WARNING_THRESHOLD).toBe(50)
    expect(VARIANT_COMBINATION_HARD_CAP).toBe(500)
  })
})

import { describe, expect, it } from 'vitest'
import {
  getVerticalAttributeSuggestions,
  getVerticalProductCopy,
} from './vertical-attributes'

describe('vertical product attribute suggestions', () => {
  it('suggests cosmetic attributes without forbidding custom fields', () => {
    const result = getVerticalAttributeSuggestions('cosmetics')

    expect(result.map((item) => item.key)).toEqual([
      'line',
      'tone',
      'volume',
      'skin_type',
      'presentation',
    ])
    expect(result.every((item) => item.customizable)).toBe(true)
  })

  it('returns independent arrays that consumers cannot mutate globally', () => {
    const first = getVerticalAttributeSuggestions('clothing')
    first[0].examples.push('Alterado')

    expect(getVerticalAttributeSuggestions('clothing')[0].examples).not.toContain('Alterado')
  })

  it('returns a safe generic profile for other', () => {
    expect(getVerticalAttributeSuggestions('other')).toEqual([])
    expect(getVerticalProductCopy('other')).toEqual({
      sectionTitle: 'Características del producto',
      sectionDescription: 'Agregá atributos personalizados si necesitás describir mejor el producto.',
    })
  })
})

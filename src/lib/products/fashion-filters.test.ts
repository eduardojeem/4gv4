import { describe, expect, it } from 'vitest'

import {
  getFashionAudienceFromTags,
  getVariantFashionValue,
  mergeFashionAudienceTag,
} from './fashion-filters'
import { clearAllProductFilters, readActiveProductFilters } from '@/lib/utils/product-filters'

describe('fashion product filters', () => {
  it('stores audience without removing unrelated product tags', () => {
    expect(mergeFashionAudienceTag(['temporada', 'audience:mujer'], 'hombre')).toEqual([
      'temporada',
      'audience:hombre',
    ])
    expect(mergeFashionAudienceTag(['temporada'], '')).toEqual(['temporada'])
  })

  it('reads a controlled audience value from tags', () => {
    expect(getFashionAudienceFromTags(['audience:ninos', 'algodon'])).toBe('ninos')
    expect(getFashionAudienceFromTags(['audience:desconocido'])).toBe('')
  })

  it('recognizes common Spanish and English variant attribute keys', () => {
    expect(getVariantFashionValue({ Talle: 'M', Color: 'Negro' }, 'size')).toBe('M')
    expect(getVariantFashionValue({ size: 'L', colour: 'Azul' }, 'size')).toBe('L')
    expect(getVariantFashionValue({ size: 'L', colour: 'Azul' }, 'color')).toBe('Azul')
  })

  it('counts and clears fashion filters from shareable catalog URLs', () => {
    const params = new URLSearchParams('audience=hombre&size=M&color=Negro&sort=newest')
    expect(readActiveProductFilters(params)).toMatchObject({
      audience: 'hombre',
      size: 'M',
      color: 'Negro',
      hasActiveFilters: true,
    })
    expect(clearAllProductFilters(params).toString()).toBe('sort=newest&page=1')
  })
})

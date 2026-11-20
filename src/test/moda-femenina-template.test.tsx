import { describe, expect, it } from 'vitest'
import {
  resolveStorefrontStyle,
  getTemplateCompatibility,
  STOREFRONT_STYLE_LABELS,
  STOREFRONT_TEMPLATES_METADATA,
} from '@/lib/website/storefront-style'
import { STOREFRONT_TEMPLATE_TIER } from '@/lib/website/template-plan-access'

describe('Moda Femenina & Elegance (Modeza) Template Integration', () => {
  it('resolves explicit moda-femenina style correctly across verticals', () => {
    expect(resolveStorefrontStyle('moda-femenina', 'clothing')).toBe('moda-femenina')
    expect(resolveStorefrontStyle('moda-femenina', 'general')).toBe('moda-femenina')
    expect(resolveStorefrontStyle('moda-femenina', 'cosmetics')).toBe('moda-femenina')
  })

  it('exposes proper label and metadata', () => {
    expect(STOREFRONT_STYLE_LABELS['moda-femenina']).toBe('Boutique Femenina & Elegance')

    const meta = STOREFRONT_TEMPLATES_METADATA['moda-femenina']
    expect(meta).toBeDefined()
    expect(meta.name).toBe('Boutique Femenina & Elegance')
    expect(meta.badge).toBe('Moda Femenina')
    expect(meta.features.length).toBeGreaterThan(0)
    expect(meta.recommendedColors).toContain('orange')
  })

  it('has compatibility mapped to fashion and general verticals', () => {
    const compatClothing = getTemplateCompatibility({
      storefrontStyle: 'moda-femenina',
      businessVertical: 'clothing',
    })
    expect(compatClothing.isRecommended).toBe(true)

    const compatGeneral = getTemplateCompatibility({
      storefrontStyle: 'moda-femenina',
      businessVertical: 'general',
    })
    expect(compatGeneral.isRecommended).toBe(true)
  })

  it('is assigned premium plan access level', () => {
    expect(STOREFRONT_TEMPLATE_TIER['moda-femenina']).toBe('premium')
  })
})

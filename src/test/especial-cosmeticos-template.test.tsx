import { describe, expect, it } from 'vitest'
import { CompanyInfoSchema } from '@/lib/validation/website-settings'
import {
  STOREFRONT_STYLE_OPTIONS,
  STOREFRONT_TEMPLATES_METADATA,
  getTemplateCompatibility,
  isStorefrontStyleAvailable,
  resolveStorefrontStyle,
} from '@/lib/website/storefront-style'
import { defaultTemplatesForPlan } from '@/lib/website/template-plan-access'

describe('Plantilla Especial Cosméticos Premium', () => {
  it('el esquema CompanyInfo valida storefrontStyle especial-cosmeticos', () => {
    const result = CompanyInfoSchema.safeParse({
      name: 'Glowora Cosmetics',
      slogan: 'Alta Cosmética & Skincare',
      storefrontStyle: 'especial-cosmeticos',
    })
    expect(result.success).toBe(true)
  })

  it('está registrada en las opciones de plantillas con descripción adecuada', () => {
    const option = STOREFRONT_STYLE_OPTIONS.find((opt) => opt.value === 'especial-cosmeticos')
    expect(option).toBeDefined()
    expect(option?.label).toBe('Especial Cosméticos Premium')
    expect(option?.description).toContain('Boutique de cosmética')
  })

  it('tiene metadatos completos y colores recomendados', () => {
    const meta = STOREFRONT_TEMPLATES_METADATA['especial-cosmeticos']
    expect(meta).toBeDefined()
    expect(meta.id).toBe('especial-cosmeticos')
    expect(meta.name).toBe('Especial Cosméticos Premium')
    expect(meta.badge).toBe('Skincare & Boutique')
    expect(meta.recommendedColors).toContain('rose')
    expect(meta.features.length).toBeGreaterThanOrEqual(4)
  })

  it('está disponible para rubros de cosmética, belleza y comercio general', () => {
    expect(isStorefrontStyleAvailable('especial-cosmeticos', { businessVertical: 'cosmetics', catalogAvailable: true })).toBe(true)
    expect(isStorefrontStyleAvailable('especial-cosmeticos', { businessVertical: 'beauty_services', catalogAvailable: true })).toBe(true)
    expect(isStorefrontStyleAvailable('especial-cosmeticos', { businessVertical: 'general', catalogAvailable: true })).toBe(true)
  })

  it('la compatibilidad es recomendada para rubros de cosmética y servicios de belleza', () => {
    const compCosmetics = getTemplateCompatibility({
      storefrontStyle: 'especial-cosmeticos',
      businessVertical: 'cosmetics',
    })
    expect(compCosmetics.isCompatible).toBe(true)
    expect(compCosmetics.isRecommended).toBe(true)

    const compBeautyServices = getTemplateCompatibility({
      storefrontStyle: 'especial-cosmeticos',
      businessVertical: 'beauty_services',
    })
    expect(compBeautyServices.isCompatible).toBe(true)
    expect(compBeautyServices.isRecommended).toBe(true)
  })

  it('está incluida en el plan ENTERPRISE como plantilla premium', () => {
    const enterpriseTemplates = defaultTemplatesForPlan('ENTERPRISE')
    expect(enterpriseTemplates).toContain('especial-cosmeticos')

    const basicTemplates = defaultTemplatesForPlan('BASIC')
    expect(basicTemplates).not.toContain('especial-cosmeticos')
  })

  it('resuelve explícitamente especial-cosmeticos cuando es la preferencia guardada', () => {
    const resolved = resolveStorefrontStyle('especial-cosmeticos', 'cosmetics', { catalogAvailable: true })
    expect(resolved).toBe('especial-cosmeticos')
  })
})

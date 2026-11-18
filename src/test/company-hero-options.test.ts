import { describe, expect, it } from 'vitest'
import { getCompanyHeroOptions } from '@/lib/website/company-hero-options'
import { resolveStorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import { getPremiumHeroForVertical } from '@/lib/website/premium-hero'

describe('getCompanyHeroOptions', () => {
  it('genera opciones estratégicas para una empresa de retail/moda', () => {
    const caps = resolveStorefrontCapabilities({
      businessVertical: 'clothing',
      operatingModel: 'retail',
      effectiveModules: ['inventory', 'ecommerce'],
    })
    const verticalDef = getPremiumHeroForVertical('clothing')
    const options = getCompanyHeroOptions(
      {
        name: 'Boutique Glamour',
        slogan: 'Vestidos & Accesorios Exclusivos',
      },
      caps,
      verticalDef
    )

    expect(options.length).toBeGreaterThanOrEqual(4)
    expect(options.map((o) => o.id)).toContain('catalog')
    expect(options.map((o) => o.id)).toContain('offers')
    expect(options.map((o) => o.id)).toContain('trust')
    expect(options.map((o) => o.id)).toContain('whatsapp')

    const catalog = options.find((o) => o.id === 'catalog')!
    expect(catalog.hero.title).toContain('Boutique Glamour')
    expect(catalog.hero.badge).toBe('Vestidos & Accesorios Exclusivos')
    expect(catalog.hero.ctaPrimaryText).toBe('Ver productos')
  })

  it('agrega la opción de Turnos & Servicios si la empresa ofrece servicios o barbería', () => {
    const caps = resolveStorefrontCapabilities({
      businessVertical: 'barbershop',
      operatingModel: 'service',
      effectiveModules: ['services', 'pos'],
    })
    const options = getCompanyHeroOptions(
      {
        name: 'Sentrix Barber',
        slogan: 'Cortes y degradés',
      },
      caps
    )

    expect(options[0].id).toBe('services')
    expect(options[0].label).toBe('Turnos & Servicios')
    expect(options[0].hero.title).toContain('Sentrix Barber')
    expect(options[0].hero.ctaPrimaryText).toBe('Reservar turno')
  })

  it('proporciona fallbacks elegantes si la empresa no tiene nombre configurado', () => {
    const caps = resolveStorefrontCapabilities({
      businessVertical: 'general',
      operatingModel: 'retail',
      effectiveModules: ['inventory'],
    })
    const options = getCompanyHeroOptions(undefined, caps)
    expect(options.length).toBe(4)
    const trust = options.find((o) => o.id === 'trust')!
    expect(trust.hero.title).toContain('Tu Empresa')
    expect(trust.hero.subtitle.length).toBeGreaterThan(10)
  })
})

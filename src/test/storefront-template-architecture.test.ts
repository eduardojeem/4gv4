import { describe, expect, it } from 'vitest'
import {
  STYLE_BY_VERTICAL,
  resolveStorefrontStyle,
  getTemplateCompatibility,
} from '@/lib/website/storefront-style'
import { buildVerticalWebsitePreset } from '@/lib/website/vertical-website-preset'
import { resolveStorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import { HERO_PRESETS } from '@/lib/website/hero-presets'
import { getWebsiteDefaultsForVertical, getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import type { BusinessVertical } from '@/lib/organization/business-profile'
import type { WebsiteSettings } from '@/types/website-settings'

describe('Section 21: Test Matrix - STYLE_BY_VERTICAL & auto resolution', () => {
  it('general + auto -> classic', () => {
    expect(resolveStorefrontStyle('auto', 'general')).toBe('classic')
  })

  it('clothing + auto -> fashion', () => {
    expect(resolveStorefrontStyle('auto', 'clothing')).toBe('fashion')
  })

  it('electronics + auto -> tech', () => {
    expect(resolveStorefrontStyle('auto', 'electronics')).toBe('tech')
  })

  it('cosmetics + auto -> beauty', () => {
    expect(resolveStorefrontStyle('auto', 'cosmetics')).toBe('beauty')
  })

  it('food + auto -> market', () => {
    expect(resolveStorefrontStyle('auto', 'food')).toBe('market')
  })

  it('hardware + auto -> classic', () => {
    expect(resolveStorefrontStyle('auto', 'hardware')).toBe('classic')
  })

  it('barbershop + auto -> services', () => {
    expect(resolveStorefrontStyle('auto', 'barbershop')).toBe('services')
  })

  it('beauty_services + auto -> services', () => {
    expect(resolveStorefrontStyle('auto', 'beauty_services')).toBe('services')
  })

  it('other + auto -> classic', () => {
    expect(resolveStorefrontStyle('auto', 'other')).toBe('classic')
  })

  it('unknown + auto -> classic fallback', () => {
    expect(resolveStorefrontStyle('auto', 'unknown_rubro')).toBe('classic')
    expect(resolveStorefrontStyle('auto', 'constructor')).toBe('classic')
  })

  it('null + auto -> classic fallback', () => {
    expect(resolveStorefrontStyle('auto', null)).toBe('classic')
  })

  it('undefined + auto -> classic fallback', () => {
    expect(resolveStorefrontStyle('auto', undefined)).toBe('classic')
    expect(resolveStorefrontStyle(undefined, undefined)).toBe('classic')
  })

  it('STYLE_BY_VERTICAL exports canonical dictionary for all supported verticals', () => {
    expect(STYLE_BY_VERTICAL).toEqual({
      general: 'classic',
      clothing: 'fashion',
      cosmetics: 'beauty',
      electronics: 'tech',
      food: 'market',
      hardware: 'classic',
      barbershop: 'services',
      beauty_services: 'services',
      other: 'classic',
    })
  })
})

describe('Section 22: Manual Template Tests', () => {
  it('electronics + modern -> modern', () => {
    expect(resolveStorefrontStyle('modern', 'electronics')).toBe('modern')
  })

  it('electronics -> cosmetics con manual modern -> modern', () => {
    // When rubro changes from electronics to cosmetics, explicit preference 'modern' wins
    const styleInElectronics = resolveStorefrontStyle('modern', 'electronics')
    const styleInCosmetics = resolveStorefrontStyle('modern', 'cosmetics')
    expect(styleInElectronics).toBe('modern')
    expect(styleInCosmetics).toBe('modern')
  })

  it('electronics -> cosmetics con auto -> beauty', () => {
    const styleInElectronics = resolveStorefrontStyle('auto', 'electronics')
    const styleInCosmetics = resolveStorefrontStyle('auto', 'cosmetics')
    expect(styleInElectronics).toBe('tech')
    expect(styleInCosmetics).toBe('beauty')
  })

  it('beauty_services + beauty manual -> beauty', () => {
    expect(resolveStorefrontStyle('beauty', 'beauty_services')).toBe('beauty')
  })

  it('barbershop + classic manual -> classic', () => {
    expect(resolveStorefrontStyle('classic', 'barbershop')).toBe('classic')
  })

  it('buildVerticalWebsitePreset preserves explicit manual template unless forced to auto', () => {
    const baseSettings: Partial<WebsiteSettings> = {
      company_info: {
        ...getWebsiteSettingsDefaults().company_info,
        storefrontStyle: 'modern',
      },
    }
    const capabilities = resolveStorefrontCapabilities({
      businessVertical: 'cosmetics',
      operatingModel: 'retail',
      effectiveModules: ['inventory', 'ecommerce'],
    })

    // Preserva plantilla manual
    const presetPreserved = buildVerticalWebsitePreset({
      vertical: 'cosmetics',
      model: 'retail',
      capabilities,
      effectiveModules: ['inventory', 'ecommerce'],
      current: baseSettings,
      overwriteCustomContent: false,
    })
    expect(presetPreserved.values.company_info?.storefrontStyle).toBe('modern')

    // Solo se pasa a auto si el usuario lo solicita explícitamente
    const presetForced = buildVerticalWebsitePreset({
      vertical: 'cosmetics',
      model: 'retail',
      capabilities,
      effectiveModules: ['inventory', 'ecommerce'],
      current: baseSettings,
      resetStorefrontStyleToAuto: true,
    })
    expect(presetForced.values.company_info?.storefrontStyle).toBe('auto')
  })
})

describe('Section 23: Content Protection Tests', () => {
  it('custom hero survives rubro change', () => {
    const customHero = {
      enabled: true,
      badge: 'Mi Banner Exclusivo',
      title: 'Título Personalizado por el Negocio',
      subtitle: 'Subtítulo completamente redactado por el usuario.',
      ctaPrimaryText: 'Comprar Ya',
      ctaSecondaryText: 'Consultas',
      trustBadges: ['Envío 24h', 'Garantizado', 'Atención'] as [string, string, string],
    }
    const current: Partial<WebsiteSettings> = {
      hero_content: customHero,
    }

    const capabilities = resolveStorefrontCapabilities({
      businessVertical: 'cosmetics',
      operatingModel: 'retail',
      effectiveModules: ['inventory', 'ecommerce'],
    })

    const preset = buildVerticalWebsitePreset({
      vertical: 'cosmetics',
      model: 'retail',
      capabilities,
      effectiveModules: ['inventory', 'ecommerce'],
      current,
      overwriteCustomContent: false,
    })

    expect(preset.values.hero_content?.title).toBe('Título Personalizado por el Negocio')
    expect(preset.values.hero_content?.badge).toBe('Mi Banner Exclusivo')
    expect(preset.summary).toContain('Portada personalizada conservada')
  })

  it('custom trust_bar survives rubro change', () => {
    const customTrustBar = {
      enabled: true,
      position: 'above_carousel' as const,
      items: [
        { id: 'custom-benefit-1', icon: 'star', title: 'Atención VIP', description: 'Atendemos con turno exclusivo', active: true },
      ],
    }
    const current: Partial<WebsiteSettings> = {
      trust_bar: customTrustBar,
    }

    const capabilities = resolveStorefrontCapabilities({
      businessVertical: 'clothing',
      operatingModel: 'retail',
      effectiveModules: ['inventory', 'ecommerce'],
    })

    const preset = buildVerticalWebsitePreset({
      vertical: 'clothing',
      model: 'retail',
      capabilities,
      effectiveModules: ['inventory', 'ecommerce'],
      current,
      overwriteCustomContent: false,
    })

    expect(preset.values.trust_bar?.items).toEqual(customTrustBar.items)
    expect(preset.summary).toContain('Beneficios personalizados conservados')
  })

  it('custom process flows survive rubro change', () => {
    const customFlows = [
      {
        id: 'user-custom-flow',
        title: 'Nuestro método único',
        description: 'Explicación propia del dueño',
        active: true,
        steps: [{ id: 's1', number: 1, title: 'Paso 1', description: 'Detalle' }],
      },
    ]
    const current: Partial<WebsiteSettings> = {
      process_flows: customFlows,
    }

    const capabilities = resolveStorefrontCapabilities({
      businessVertical: 'hardware',
      operatingModel: 'retail',
      effectiveModules: ['inventory', 'ecommerce'],
    })

    const preset = buildVerticalWebsitePreset({
      vertical: 'hardware',
      model: 'retail',
      capabilities,
      effectiveModules: ['inventory', 'ecommerce'],
      current,
      overwriteCustomContent: false,
    })

    expect(preset.values.process_flows).toEqual(customFlows)
    expect(preset.summary).toContain('Recorrido de atención personalizado conservado')
  })

  it('custom stats survive rubro change', () => {
    const customStats = {
      enabled: true,
      repairs: '350',
      satisfaction: '95%',
      avgTime: '48h',
    }
    const current: Partial<WebsiteSettings> = {
      hero_stats: customStats,
    }

    const capabilities = resolveStorefrontCapabilities({
      businessVertical: 'food',
      operatingModel: 'retail',
      effectiveModules: ['inventory', 'ecommerce'],
    })

    const preset = buildVerticalWebsitePreset({
      vertical: 'food',
      model: 'retail',
      capabilities,
      effectiveModules: ['inventory', 'ecommerce'],
      current,
      overwriteCustomContent: false,
    })

    expect(preset.values.hero_stats).toEqual(customStats)
  })

  it('empty storefront can receive preset', () => {
    const capabilities = resolveStorefrontCapabilities({
      businessVertical: 'clothing',
      operatingModel: 'retail',
      effectiveModules: ['inventory', 'ecommerce'],
    })

    const preset = buildVerticalWebsitePreset({
      vertical: 'clothing',
      model: 'retail',
      capabilities,
      effectiveModules: ['inventory', 'ecommerce'],
      current: {},
      overwriteCustomContent: false,
    })

    expect(preset.values.hero_content?.enabled).toBe(true)
    expect(preset.values.hero_content?.title).toBe('Estilo, calidad y las mejores marcas para vos')
    expect(preset.values.trust_bar?.enabled).toBe(true)
    expect(preset.values.trust_bar?.items.length).toBeGreaterThan(0)
  })

  it('explicit replace confirmation can apply preset over customized content', () => {
    const current: Partial<WebsiteSettings> = {
      hero_content: {
        title: 'Mi Título Antiguo Personalizado',
        subtitle: 'Mi subtítulo antiguo',
        badge: 'Antiguo',
      },
    }

    const capabilities = resolveStorefrontCapabilities({
      businessVertical: 'clothing',
      operatingModel: 'retail',
      effectiveModules: ['inventory', 'ecommerce'],
    })

    const preset = buildVerticalWebsitePreset({
      vertical: 'clothing',
      model: 'retail',
      capabilities,
      effectiveModules: ['inventory', 'ecommerce'],
      current,
      overwriteCustomContent: true, // Usuario confirmó el reemplazo
    })

    expect(preset.values.hero_content?.title).toBe('Estilo, calidad y las mejores marcas para vos')
    expect(preset.summary).toContain('Textos de la portada')
  })
})

describe('Section 24: Claim Tests - No unverified stats or misleading claims in presets', () => {
  it('hero presets do not include unverified numbers (15K+, 99%, 100%, 4.9★, 30-45 min)', () => {
    for (const preset of HERO_PRESETS) {
      expect(preset.stats.repairs).not.toMatch(/15K\+|10K\+|5\.000\+|8\.000\+|2\.000\+|100%/)
      expect(preset.stats.satisfaction).not.toMatch(/99%|100%|4\.9★|4\.8★|98%/)
      expect(preset.stats.avgTime).not.toMatch(/30-45 min|1-3 horas|Sin espera/)
      expect(preset.stats.repairs).toBe('')
      expect(preset.stats.satisfaction).toBe('')
      expect(preset.stats.avgTime).toBe('')

      for (const badge of preset.trustBadges) {
        expect(badge).not.toMatch(/Garantía oficial|100% Calidad|Garantía escrita|Higiene garantizada/)
      }
    }
  })

  it('default settings by vertical have stats disabled and empty', () => {
    const verticals: readonly BusinessVertical[] = ['general', 'clothing', 'cosmetics', 'barbershop', 'food', 'hardware', 'electronics']
    for (const v of verticals) {
      const defaults = getWebsiteDefaultsForVertical(v)
      if (defaults.hero_stats) {
        expect(defaults.hero_stats.enabled).toBe(false)
        expect(defaults.hero_stats.repairs).toBe('')
        expect(defaults.hero_stats.satisfaction).toBe('')
        expect(defaults.hero_stats.avgTime).toBe('')
      }
    }
  })

  it('global website settings defaults have stats disabled and empty', () => {
    const defaults = getWebsiteSettingsDefaults()
    expect(defaults.hero_stats.enabled).toBe(false)
    expect(defaults.hero_stats.repairs).toBe('')
    expect(defaults.hero_stats.satisfaction).toBe('')
    expect(defaults.hero_stats.avgTime).toBe('')
  })
})

describe('Section 25: Compatibility Tests', () => {
  it('services without services module -> warning & requires_modules', () => {
    const comp = getTemplateCompatibility({
      storefrontStyle: 'services',
      currentStyle: 'classic',
      businessVertical: 'general',
      modules: ['inventory', 'pos'], // Sin módulo 'services'
      servicesAvailable: false,
    })

    expect(comp.status).toBe('requires_modules')
    expect(comp.isCompatible).toBe(false)
    expect(comp.missingModules).toContain('services')
    expect(comp.warnings.length).toBeGreaterThan(0)
    expect(comp.warnings[0]).toContain('Servicios y Agenda')
  })

  it('tech without repairs -> allowed and compatible', () => {
    const comp = getTemplateCompatibility({
      storefrontStyle: 'tech',
      currentStyle: 'classic',
      businessVertical: 'electronics',
      modules: ['inventory', 'pos', 'ecommerce'], // Sin repairs
      repairsAvailable: false,
    })

    expect(comp.status).not.toBe('requires_modules')
    expect(comp.isCompatible).toBe(true)
    expect(comp.missingModules).toEqual([])
  })

  it('beauty cosmetics without services -> allowed and compatible', () => {
    const comp = getTemplateCompatibility({
      storefrontStyle: 'beauty',
      currentStyle: 'classic',
      businessVertical: 'cosmetics',
      modules: ['inventory', 'pos', 'ecommerce'], // Sin services
      servicesAvailable: false,
    })

    expect(comp.status).not.toBe('requires_modules')
    expect(comp.isCompatible).toBe(true)
    expect(comp.missingModules).toEqual([])
    expect(comp.isRecommended).toBe(true)
  })

  it('fashion without Mujer/Hombre/Niños categories flags missingData audiences', () => {
    const comp = getTemplateCompatibility({
      storefrontStyle: 'fashion',
      currentStyle: 'classic',
      businessVertical: 'clothing',
      categories: [{ name: 'Accesorios' }, { name: 'Varios' }],
    })

    expect(comp.missingData).toContain('audiences')
  })

  it('sport without those categories flags missingData audiences', () => {
    const comp = getTemplateCompatibility({
      storefrontStyle: 'sport',
      currentStyle: 'classic',
      businessVertical: 'clothing',
      categories: [{ name: 'Pelotas' }, { name: 'Redes' }],
    })

    expect(comp.missingData).toContain('audiences')
  })
})

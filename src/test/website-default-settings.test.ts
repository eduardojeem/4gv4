import { describe, expect, it } from 'vitest'
import { applyWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { OffersSectionSchema } from '@/lib/validation/website-settings'
import type { WebsiteSettings } from '@/types/website-settings'

describe('applyWebsiteSettingsDefaults', () => {
  it('keeps the public cart enabled by default for existing organizations', () => {
    const result = applyWebsiteSettingsDefaults({} as Partial<WebsiteSettings>)

    expect(result.checkout.commerceMode).toBe('cart')
  })

  it('keeps the process section hidden until an organization configures it', () => {
    const result = applyWebsiteSettingsDefaults({} as Partial<WebsiteSettings>)

    expect(result.company_info.processSectionEnabled).toBe(false)
  })

  it('accepts the expanded offers accent palette', () => {
    const base = applyWebsiteSettingsDefaults({} as Partial<WebsiteSettings>).offers_section
    const colors = ['brand', 'rose', 'amber', 'orange', 'emerald', 'blue', 'sky', 'violet', 'fuchsia', 'red', 'teal']

    colors.forEach((accentColor) => {
      expect(OffersSectionSchema.safeParse({ ...base, accentColor }).success).toBe(true)
    })
  })

  it('deep merges nested company info fields', () => {
    const result = applyWebsiteSettingsDefaults({
      company_info: {
        name: '4G',
        hours: {
          weekdays: '08:00 - 18:00',
          saturday: ''
        }
      }
    } as Partial<WebsiteSettings>)

    expect(result.company_info.name).toBe('4G')
    expect(result.company_info.phone).toBe('')
    expect(result.company_info.hours.weekdays).toBe('08:00 - 18:00')
    expect(result.company_info.hours.saturday).toBe('')
    expect(result.company_info.hours.sunday).toBe('')
    expect(result.company_info.showTopBar).toBe(true)
  })

  it('preserves provided maintenance fields while backfilling missing ones', () => {
    const result = applyWebsiteSettingsDefaults({
      maintenance_mode: {
        enabled: true,
        title: 'Mantenimiento programado'
      }
    } as Partial<WebsiteSettings>)

    expect(result.maintenance_mode.enabled).toBe(true)
    expect(result.maintenance_mode.title).toBe('Mantenimiento programado')
    expect(result.maintenance_mode.message).toBe('Estamos realizando mejoras en nuestro sitio. Volveremos pronto.')
    expect(result.maintenance_mode.estimatedEnd).toBe('')
  })

  it('enables the offers section by default and preserves tenant customization', () => {
    const defaults = applyWebsiteSettingsDefaults({} as Partial<WebsiteSettings>)
    const customized = applyWebsiteSettingsDefaults({
      offers_section: {
        enabled: false,
        title: 'Liquidacion de temporada',
        accentColor: 'brand',
      },
    } as Partial<WebsiteSettings>)

    expect(defaults.offers_section.enabled).toBe(true)
    expect(defaults.offers_section.accentColor).toBe('rose')
    expect(customized.offers_section.enabled).toBe(false)
    expect(customized.offers_section.title).toBe('Liquidacion de temporada')
    expect(customized.offers_section.accentColor).toBe('brand')
    expect(customized.offers_section.subtitle).toBe(defaults.offers_section.subtitle)
  })
})

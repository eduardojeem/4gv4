import { describe, expect, it } from 'vitest'
import { getWebsiteSettingsDefaults, applyWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { validateSetting, isWebsiteSettingKey, SETTING_SCHEMAS } from '@/lib/validation/website-settings'

const validTrustBar = {
  enabled: true,
  position: 'above_carousel' as const,
  items: [
    {
      id: 'shipping',
      icon: 'truck',
      title: 'Envíos Rápidos',
      description: 'A domicilio o retiro en tienda',
      active: true,
    },
    {
      id: 'payments',
      icon: 'credit-card',
      title: 'Medios de Pago',
      description: 'Tarjetas, cuotas y transferencias',
      active: true,
    },
  ],
}

describe('trust_bar website setting', () => {
  it('is recognized as a valid website setting key and schema', () => {
    expect(isWebsiteSettingKey('trust_bar')).toBe(true)
    expect(SETTING_SCHEMAS.trust_bar).toBeDefined()
  })

  it('provides complete and valid defaults', () => {
    const defaults = getWebsiteSettingsDefaults().trust_bar
    expect(defaults).toBeDefined()
    expect(defaults?.enabled).toBe(true)
    expect(defaults?.position).toBe('above_carousel')
    expect(defaults?.items).toHaveLength(4)
    expect(validateSetting('trust_bar', defaults).success).toBe(true)
  })

  it('preserves saved trust_bar settings across applyWebsiteSettingsDefaults', () => {
    const applied = applyWebsiteSettingsDefaults({
      trust_bar: {
        enabled: false,
        position: 'bottom',
        items: [
          {
            id: 'custom-1',
            icon: 'star',
            title: 'Atención 24/7',
            description: 'Soporte permanente',
            active: true,
          },
        ],
      },
    })

    expect(applied.trust_bar?.enabled).toBe(false)
    expect(applied.trust_bar?.position).toBe('bottom')
    expect(applied.trust_bar?.items).toHaveLength(1)
    expect(applied.trust_bar?.items[0].title).toBe('Atención 24/7')
  })

  it('accepts valid custom trust bar configuration', () => {
    expect(validateSetting('trust_bar', validTrustBar).success).toBe(true)
  })

  it('rejects invalid position or empty item title', () => {
    expect(
      validateSetting('trust_bar', {
        ...validTrustBar,
        position: 'invalid_position',
      }).success
    ).toBe(false)

    expect(
      validateSetting('trust_bar', {
        ...validTrustBar,
        items: [{ id: '1', icon: 'shield', title: '', description: '' }],
      }).success
    ).toBe(false)
  })

  it('limits the items count to 6', () => {
    const tooManyItems = {
      ...validTrustBar,
      items: Array.from({ length: 7 }, (_, i) => ({
        id: `item-${i}`,
        icon: 'shield',
        title: `Beneficio ${i}`,
        description: `Desc ${i}`,
        active: true,
      })),
    }

    expect(validateSetting('trust_bar', tooManyItems).success).toBe(false)
  })
})

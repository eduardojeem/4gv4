import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HeroSection } from '@/components/public/inicio/HeroSection'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { validateSetting } from '@/lib/validation/website-settings'
import { getBrandTheme } from '@/lib/constants/brand-theme'

const baseHero = {
  badge: 'Servicio especializado',
  title: 'Soluciones para tu celular',
  subtitle: 'Productos y soporte profesional para mantenerte conectado.',
}

describe('hero visibility', () => {
  it('keeps the hero enabled for existing organizations', () => {
    expect(getWebsiteSettingsDefaults().hero_content.enabled).toBe(true)
  })

  it('persists the disabled state in the hero setting', () => {
    const result = validateSetting('hero_content', { ...baseHero, enabled: false })
    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({ enabled: false })
  })

  it('does not render public hero content when disabled', () => {
    const { container } = render(
      <HeroSection
        companyInfo={{
          name: '4G Celulares',
          phone: '',
          email: '',
          address: '',
          hours: { weekdays: '', saturday: '', sunday: '' },
          brandColor: 'blue',
        }}
        heroStats={{ enabled: false, repairs: '0+', satisfaction: '0%', avgTime: '24h' }}
        heroContent={{ ...baseHero, enabled: false }}
        brand={getBrandTheme('blue')}
        phoneClean=""
        contactHref="/inicio#contacto"
      />
    )

    expect(container).toBeEmptyDOMElement()
  })
})

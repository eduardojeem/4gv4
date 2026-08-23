/**
 * Banner de campañas de /ofertas (offers_carousel).
 *
 * Es el mismo componente y el mismo editor que el banner del inicio; lo único
 * propio es la clave de settings, para que cada página publique sus campañas.
 * Los tests cubren justamente eso: que la clave nueva se complete sola en
 * settings viejos, que valide igual que la del inicio, y que el banner de
 * /ofertas lea sus slides y no los del inicio.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { applyWebsiteSettingsDefaults, getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { SETTING_SCHEMAS, isWebsiteSettingKey } from '@/lib/validation/website-settings'
import type { PromotionalCarouselSettings, WebsiteSettings } from '@/types/website-settings'

vi.mock('next/navigation', () => ({
  usePathname: () => '/ofertas',
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a href={typeof href === 'string' ? href : '#'}>{children}</a>
  ),
}))

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, src }: { alt?: string; src?: string }) => (
    <img alt={alt} src={typeof src === 'string' ? src : ''} />
  ),
}))

import { PromotionalCarousel } from '@/components/public/inicio/PromotionalCarousel'

function slide(overrides: Record<string, unknown> = {}) {
  return {
    id: 'slide-1',
    title: 'Semana de ofertas',
    message: 'Hasta 40% en toda la tienda',
    imageUrl: '/banner.jpg',
    imageAlt: 'Banner de campaña',
    ctaText: 'Ver ofertas',
    ctaHref: '/productos',
    active: true,
    textTone: 'light' as const,
    contentAlign: 'left' as const,
    ...overrides,
  }
}

function carousel(overrides: Partial<PromotionalCarouselSettings> = {}): PromotionalCarouselSettings {
  return {
    enabled: true,
    autoplay: true,
    intervalSeconds: 6,
    slides: [slide()],
    ...overrides,
  }
}

describe('offers_carousel — settings', () => {
  it('completa la clave en settings guardados antes de que existiera', () => {
    const applied = applyWebsiteSettingsDefaults({
      company_info: { phone: '', email: '', address: '', hours: { weekdays: '', saturday: '', sunday: '' } },
    } as Partial<WebsiteSettings>)

    expect(applied.offers_carousel).toEqual(getWebsiteSettingsDefaults().offers_carousel)
    expect(applied.offers_carousel?.slides).toEqual([])
  })

  it('conserva los slides guardados y no los pisa con los defaults', () => {
    const applied = applyWebsiteSettingsDefaults({
      offers_carousel: carousel({ intervalSeconds: 9 }),
    } as Partial<WebsiteSettings>)

    expect(applied.offers_carousel?.slides).toHaveLength(1)
    expect(applied.offers_carousel?.intervalSeconds).toBe(9)
  })

  it('no mezcla los slides del inicio con los de ofertas', () => {
    const applied = applyWebsiteSettingsDefaults({
      promotional_carousel: carousel({ slides: [slide({ id: 'inicio', title: 'Campaña del inicio' })] }),
      offers_carousel: carousel({ slides: [slide({ id: 'ofertas', title: 'Campaña de ofertas' })] }),
    } as Partial<WebsiteSettings>)

    expect(applied.promotional_carousel?.slides[0].title).toBe('Campaña del inicio')
    expect(applied.offers_carousel?.slides[0].title).toBe('Campaña de ofertas')
  })

  it('la API acepta offers_carousel como clave editable', () => {
    expect(isWebsiteSettingKey('offers_carousel')).toBe(true)
    expect(SETTING_SCHEMAS.offers_carousel.safeParse(carousel()).success).toBe(true)
  })

  it('valida con las mismas reglas que el carrusel del inicio', () => {
    // intervalSeconds fuera de rango y mas de 6 slides deben fallar igual.
    expect(SETTING_SCHEMAS.offers_carousel.safeParse(carousel({ intervalSeconds: 99 })).success).toBe(false)
    expect(SETTING_SCHEMAS.offers_carousel.safeParse(
      carousel({ slides: Array.from({ length: 7 }, (_, i) => slide({ id: `s${i}` })) })
    ).success).toBe(false)
  })
})

describe('offers_carousel — render en /ofertas', () => {
  it('muestra el slide activo con su imagen y su CTA', () => {
    render(<PromotionalCarousel settings={carousel()} />)

    expect(screen.getByText('Semana de ofertas')).toBeInTheDocument()
    expect(screen.getByText('Hasta 40% en toda la tienda')).toBeInTheDocument()
    expect(screen.getByAltText('Banner de campaña')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver ofertas' })).toBeInTheDocument()
  })

  it('no dibuja nada sin slides: por eso arranca habilitado sin molestar', () => {
    const { container } = render(<PromotionalCarousel settings={carousel({ slides: [] })} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('no dibuja nada si está desactivado, aunque tenga slides', () => {
    const { container } = render(<PromotionalCarousel settings={carousel({ enabled: false })} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('ignora los slides marcados como inactivos', () => {
    const { container } = render(
      <PromotionalCarousel settings={carousel({ slides: [slide({ active: false })] })} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('no se cae si la clave no vino en los settings', () => {
    expect(() => render(<PromotionalCarousel settings={undefined} />)).not.toThrow()
  })
})

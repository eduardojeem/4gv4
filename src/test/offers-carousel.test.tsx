/**
 * Carrusel de ofertas: settings + render compartido.
 *
 * Cubre las dos cosas que se pueden romper en silencio:
 *  - la retrocompatibilidad de offers_section (settings guardados antes de que
 *    el carrusel existiera no traen la clave `carousel`), y
 *  - que el editor de /admin/website pueda seguir guardando offers_section sin
 *    mandar `carousel`.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { applyWebsiteSettingsDefaults, getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { OffersSectionSchema } from '@/lib/validation/website-settings'
import {
  OFFER_ACCENTS,
  OffersCarouselDeck,
  type OfferSlide,
} from '@/components/public/offers/OffersCarouselDeck'

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: Record<string, unknown> & { children?: React.ReactNode; href?: string }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>{children}</a>
  ),
}))

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, src }: { alt?: string; src?: string }) => <img alt={alt} src={typeof src === 'string' ? src : ''} />,
}))

const defaults = getWebsiteSettingsDefaults().offers_section

function slide(overrides: Partial<OfferSlide> = {}): OfferSlide {
  return {
    id: 'product-1',
    title: 'Celular X',
    description: 'Un producto en oferta',
    priceLabel: 'Gs. 800.000',
    originalPriceLabel: 'Gs. 1.000.000',
    tag: '-20%',
    ctaHref: '/productos/product-1',
    image: null,
    brand: 'Marca',
    inStock: true,
    ...overrides,
  }
}

describe('offers_section carousel settings', () => {
  it('completa el carrusel cuando los settings guardados no lo traen', () => {
    const applied = applyWebsiteSettingsDefaults({
      offers_section: {
        enabled: true,
        eyebrow: 'Ofertas',
        title: 'Titulo guardado',
        subtitle: 'Subtitulo guardado',
        accentColor: 'amber',
      } as never,
    })

    expect(applied.offers_section.title).toBe('Titulo guardado')
    expect(applied.offers_section.carousel).toEqual(defaults.carousel)
  })

  it('hace merge profundo de un carrusel parcial sin perder los defaults', () => {
    const applied = applyWebsiteSettingsDefaults({
      offers_section: {
        ...defaults,
        carousel: { enabled: false, maxItems: 12 },
      } as never,
    })

    expect(applied.offers_section.carousel.enabled).toBe(false)
    expect(applied.offers_section.carousel.maxItems).toBe(12)
    // Lo no enviado sobrevive.
    expect(applied.offers_section.carousel.intervalSeconds).toBe(defaults.carousel.intervalSeconds)
    expect(applied.offers_section.carousel.title).toBe(defaults.carousel.title)
  })

  it('valida offers_section sin carousel: el editor de /admin/website no manda esa clave', () => {
    const withoutCarousel = {
      enabled: true,
      eyebrow: 'Ofertas especiales',
      title: 'Precios que valen la pena',
      subtitle: 'Productos seleccionados con descuento.',
      accentColor: 'rose',
    }

    expect(OffersSectionSchema.safeParse(withoutCarousel).success).toBe(true)
  })

  it('rechaza valores de carrusel fuera de rango', () => {
    const base = {
      enabled: true,
      eyebrow: 'Ofertas especiales',
      title: 'Precios que valen la pena',
      subtitle: 'Productos seleccionados con descuento.',
      accentColor: 'rose' as const,
    }

    expect(OffersSectionSchema.safeParse({
      ...base,
      carousel: { ...defaults.carousel, intervalSeconds: 120 },
    }).success).toBe(false)

    expect(OffersSectionSchema.safeParse({
      ...base,
      carousel: { ...defaults.carousel, maxItems: 1 },
    }).success).toBe(false)

    expect(OffersSectionSchema.safeParse({
      ...base,
      carousel: defaults.carousel,
    }).success).toBe(true)
  })
})

describe('OffersCarouselDeck', () => {
  const accent = OFFER_ACCENTS.rose

  it('renderiza una tarjeta por oferta con su precio y su precio tachado', () => {
    render(
      <OffersCarouselDeck
        offers={[slide(), slide({ id: 'product-2', title: 'Celular Y' })]}
        accent={accent}
        fallbackBrand="Tienda"
        tenantPrefix=""
      />
    )

    expect(screen.getByText('Celular X')).toBeInTheDocument()
    expect(screen.getByText('Celular Y')).toBeInTheDocument()
    expect(screen.getAllByText('Gs. 800.000')).toHaveLength(2)
    expect(screen.getAllByText('Gs. 1.000.000')).toHaveLength(2)
  })

  it('antepone el prefijo de tenant a los links de producto', () => {
    render(
      <OffersCarouselDeck
        offers={[slide()]}
        accent={accent}
        fallbackBrand="Tienda"
        tenantPrefix="/mi-tienda"
      />
    )

    expect(screen.getByRole('link', { name: 'Ver detalle' }))
      .toHaveAttribute('href', '/mi-tienda/productos/product-1')
  })

  it('usa la marca de respaldo cuando el producto no tiene marca', () => {
    render(
      <OffersCarouselDeck
        offers={[slide({ brand: null })]}
        accent={accent}
        fallbackBrand="Mi Tienda"
        tenantPrefix=""
      />
    )

    expect(screen.getByText('Mi Tienda')).toBeInTheDocument()
  })

  it('oculta el botón de pausa cuando la rotación automática está apagada', () => {
    const offers = [slide(), slide({ id: 'product-2' })]

    const { rerender } = render(
      <OffersCarouselDeck offers={offers} accent={accent} fallbackBrand="T" tenantPrefix="" autoplay />
    )
    expect(screen.getByLabelText('Pausar carrusel')).toBeInTheDocument()

    rerender(
      <OffersCarouselDeck offers={offers} accent={accent} fallbackBrand="T" tenantPrefix="" autoplay={false} />
    )
    expect(screen.queryByLabelText('Pausar carrusel')).not.toBeInTheDocument()
    // Los indicadores siguen estando: se puede navegar a mano.
    expect(screen.getAllByRole('tab')).toHaveLength(2)
  })

  it('no muestra controles de navegación con una sola oferta', () => {
    render(
      <OffersCarouselDeck offers={[slide()]} accent={accent} fallbackBrand="T" tenantPrefix="" />
    )

    expect(screen.queryByLabelText('Siguiente oferta')).not.toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })
})

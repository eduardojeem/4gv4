/**
 * Verifica el cableado real de /ofertas: que la banda del carrusel aparezca
 * cuando hay ofertas, y que se apague sola cuando corresponde.
 *
 * Existe porque el carrusel "no se veía" y hacía falta separar un problema de
 * código de uno de datos o de entorno.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import type { WebsiteSettings } from '@/types/website-settings'

let liveSettings: WebsiteSettings | null = null
let swrData: unknown

vi.mock('@/hooks/useWebsiteSettings', () => ({
  useWebsiteSettings: () => ({ settings: liveSettings, isLoading: false, error: null }),
}))

vi.mock('@/lib/public/tenant-client', () => ({
  usePublicTenantPrefix: () => ({ tenantPrefix: '' }),
}))

vi.mock('@/hooks/use-public-cart', () => ({
  usePublicCart: () => ({
    addItem: vi.fn(),
    items: [],
    totalItems: 0,
  }),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/ofertas',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('swr', () => ({
  __esModule: true,
  default: (_key: unknown, _fetcher: unknown, options?: { fallbackData?: unknown }) => ({
    data: swrData ?? options?.fallbackData,
    error: undefined,
    isLoading: false,
  }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
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

import { OffersPageClient } from '@/app/(public)/ofertas/OffersPageClient'

type OfferInput = {
  id: string
  name: string
  sale_price: number
  offer_price: number
}

function offer({ id, name, sale_price, offer_price }: OfferInput) {
  return {
    id,
    name,
    brand: 'Marca',
    description: 'Descripcion',
    sale_price,
    offer_price,
    has_offer: true,
    in_stock: true,
    stock_quantity: 5,
    featured: false,
    image: null,
    images: null,
    category: { id: 'cat-1', name: 'Celulares' },
  }
}

const offers = [
  offer({ id: 'p1', name: 'Celular Barato', sale_price: 1_000_000, offer_price: 500_000 }),
  offer({ id: 'p2', name: 'Celular Medio', sale_price: 1_000_000, offer_price: 900_000 }),
]

function renderPage(settings: WebsiteSettings, initialOffers = offers) {
  return render(
    <OffersPageClient
      initialSettings={settings}
      initialOffers={initialOffers as never}
    />
  )
}

describe('/ofertas — banda del carrusel', () => {
  beforeEach(() => {
    liveSettings = null
    swrData = undefined
  })

  it('muestra el carrusel cuando hay ofertas y está activado', () => {
    const settings = getWebsiteSettingsDefaults()
    renderPage(settings)

    expect(screen.getByText(settings.offers_section.carousel.title)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Carrusel de ofertas destacadas' })).toBeInTheDocument()
  })

  it('ordena los slides por mayor descuento', () => {
    const settings = getWebsiteSettingsDefaults()
    renderPage(settings)

    const track = screen.getByRole('region', { name: 'Carrusel de ofertas destacadas' })
    const titles = Array.from(track.querySelectorAll('h3')).map((node) => node.textContent)
    // 50% de descuento va antes que 10%.
    expect(titles[0]).toBe('Celular Barato')
    expect(titles[1]).toBe('Celular Medio')
  })

  it('respeta maxItems', () => {
    const settings = getWebsiteSettingsDefaults()
    settings.offers_section.carousel.maxItems = 1
    renderPage(settings)

    const track = screen.getByRole('region', { name: 'Carrusel de ofertas destacadas' })
    expect(track.querySelectorAll('h3')).toHaveLength(1)
  })

  it('oculta el carrusel cuando está desactivado, pero deja la grilla', () => {
    const settings = getWebsiteSettingsDefaults()
    settings.offers_section.carousel.enabled = false
    renderPage(settings)

    expect(screen.queryByRole('region', { name: 'Carrusel de ofertas destacadas' })).not.toBeInTheDocument()
    // La grilla sigue mostrando el producto.
    expect(screen.getAllByText('Celular Barato').length).toBeGreaterThan(0)
  })

  it('sin ofertas no hay carrusel: no es un bug del carrusel sino falta de datos', () => {
    const settings = getWebsiteSettingsDefaults()
    renderPage(settings, [])

    expect(screen.queryByRole('region', { name: 'Carrusel de ofertas destacadas' })).not.toBeInTheDocument()
  })

  it('no se cae si unos settings viejos no traen la clave carousel', () => {
    const settings = getWebsiteSettingsDefaults()
    // Simula settings servidos por una version anterior al carrusel.
    delete (settings.offers_section as Partial<WebsiteSettings['offers_section']>).carousel

    expect(() => renderPage(settings)).not.toThrow()
    // Y cae en los defaults, así que el carrusel igual se muestra.
    expect(screen.getByRole('region', { name: 'Carrusel de ofertas destacadas' })).toBeInTheDocument()
  })
})

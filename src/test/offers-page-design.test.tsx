import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import type { PublicCommerceMode } from '@/types/website-settings'

const control = vi.hoisted(() => ({ addProduct: vi.fn(() => ({ limited: false, quantity: 1 })) }))

vi.mock('@/hooks/useWebsiteSettings', () => ({
  useWebsiteSettings: () => ({ settings: null, isLoading: false, error: null }),
}))
vi.mock('@/lib/public/tenant-client', () => ({ usePublicTenantPrefix: () => ({ tenantPrefix: '/tienda-demo' }) }))
vi.mock('@/hooks/use-public-cart', () => ({ usePublicCart: () => ({ addProduct: control.addProduct }) }))
vi.mock('next/navigation', () => ({
  usePathname: () => '/tienda-demo/ofertas',
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('swr', () => ({
  __esModule: true,
  default: (_key: unknown, _fetcher: unknown, options?: { fallbackData?: unknown }) => ({
    data: options?.fallbackData,
    error: undefined,
    isLoading: false,
    mutate: vi.fn(),
  }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, src }: { alt?: string; src?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}))

import { OffersPageClient, availableOfferTiers, paginationItems } from '@/app/(public)/ofertas/OffersPageClient'
import { StorefrontStyleProvider } from '@/components/public/storefront-style-context'

function oferta(id: string, name: string, sale: number, offer: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    name,
    brand: 'Marca',
    description: null,
    sale_price: sale,
    offer_price: offer,
    has_offer: true,
    in_stock: true,
    stock_quantity: 5,
    featured: false,
    image: null,
    images: null,
    category: { id: 'c1', name: 'Remeras' },
    created_at: null,
    ...extra,
  }
}

function ajustes(mode: PublicCommerceMode = 'cart') {
  const settings = getWebsiteSettingsDefaults()
  // El carrusel tiene su propia prueba; acá solo interesa el listado.
  settings.offers_section.carousel.enabled = false
  settings.checkout.commerceMode = mode
  settings.company_info = { ...settings.company_info, name: 'DA', whatsapp: '595981123456' }
  return settings
}

const pintar = (offers: unknown[], settings = ajustes()) =>
  render(<OffersPageClient initialSettings={settings} initialOffers={offers as never} />)

const tarjetas = () => screen.queryAllByRole('article')

beforeEach(() => control.addProduct.mockClear())

describe('el encabezado de /ofertas', () => {
  it('usa los textos del dueño y un resumen corto', () => {
    const settings = ajustes()
    pintar([oferta('p1', 'Remera', 100_000, 50_000), oferta('p2', 'Buzo', 200_000, 180_000)], settings)

    expect(screen.getByRole('heading', { level: 1, name: settings.offers_section.title })).toBeInTheDocument()
    expect(screen.getByText('hasta -50%', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText('2', { selector: 'dd' })).toBeInTheDocument()
  })

  it('no habla de ropa ni promete garantía o cuotas que la tienda no configuró', () => {
    pintar([oferta('p1', 'Celular', 100_000, 50_000)])
    expect(screen.queryByText(/prendas/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/liquidaci/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/garantía oficial/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/financiación/i)).not.toBeInTheDocument()
  })
})

describe('los filtros rápidos', () => {
  const a50 = oferta('a', 'A', 100, 50, { featured: true })
  const b10 = oferta('b', 'B', 100, 90)
  const c25 = oferta('c', 'C', 100, 75, { in_stock: false })

  it('solo aparecen los que cambian el listado', () => {
    expect(availableOfferTiers([a50, b10, c25] as never)).toEqual(['30', '20', 'featured', 'stock'])
    // Todas superan el 30%: ningún tramo filtra nada.
    expect(availableOfferTiers([a50, oferta('d', 'D', 100, 60)] as never)).toEqual(['featured'])
    // «20% o más» daría lo mismo que «30% o más».
    expect(availableOfferTiers([oferta('e', 'E', 100, 50), oferta('f', 'F', 100, 65), b10] as never)).toEqual(['30'])
  })

  it('«30% o más» deja solo esas ofertas y el resumen lo dice', () => {
    pintar([oferta('p1', 'Remera', 100_000, 50_000), oferta('p2', 'Buzo', 100_000, 90_000)])
    fireEvent.click(screen.getByRole('button', { name: '30% o más' }))

    expect(screen.getByRole('button', { name: '30% o más' })).toHaveAttribute('aria-pressed', 'true')
    expect(tarjetas()).toHaveLength(1)
    expect(screen.getByText('1 oferta de 2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Limpiar filtros/ }))
    expect(tarjetas()).toHaveLength(2)
  })

  it('las categorías aparecen solo con dos o más, y filtran', () => {
    const { unmount } = pintar([oferta('p1', 'Remera', 100, 50), oferta('p2', 'Remera 2', 100, 60)])
    expect(screen.queryByRole('button', { name: 'Remeras' })).not.toBeInTheDocument()
    unmount()

    pintar([oferta('p1', 'Remera', 100, 50), oferta('p2', 'Buzo', 100, 60, { category: { id: 'c2', name: 'Buzos' } })])
    fireEvent.click(screen.getByRole('button', { name: 'Buzos' }))
    expect(tarjetas()).toHaveLength(1)
    expect(within(tarjetas()[0]).getByRole('link', { name: 'Buzo' })).toBeInTheDocument()
  })
})

describe('las tarjetas', () => {
  it('las agotadas van al final y lo dicen', () => {
    pintar([oferta('p1', 'Campera', 100_000, 40_000, { in_stock: false }), oferta('p2', 'Remera', 100_000, 90_000)])
    const [primera, ultima] = tarjetas()
    expect(within(primera).getByRole('link', { name: 'Remera' })).toBeInTheDocument()
    expect(within(ultima).getByText('Sin stock')).toBeInTheDocument()
    expect(within(ultima).getByRole('button', { name: 'Agregar Campera al carrito' })).toBeDisabled()
  })

  it('con carrito, un botón agrega el producto al precio de oferta', () => {
    pintar([oferta('p1', 'Remera', 100_000, 50_000)])
    fireEvent.click(screen.getByRole('button', { name: 'Agregar Remera al carrito' }))
    expect(control.addProduct).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }), 50_000, 1)
  })

  it('con WhatsApp, un botón para consultar', () => {
    pintar([oferta('p1', 'Remera', 100_000, 50_000)], ajustes('whatsapp'))
    expect(screen.getByRole('link', { name: 'Consultar por Remera en WhatsApp' })).toHaveAttribute('target', '_blank')
    expect(screen.queryByRole('button', { name: /al carrito/ })).not.toBeInTheDocument()
  })

  it('en modo catálogo, un botón al detalle', () => {
    pintar([oferta('p1', 'Remera', 100_000, 50_000)], ajustes('catalog'))
    expect(screen.getByRole('link', { name: 'Ver detalle de Remera' })).toHaveAttribute('href', '/tienda-demo/productos/p1')
  })

  it('en Moda la foto va vertical, como en el resto de la tienda', () => {
    const { container } = render(
      <StorefrontStyleProvider style="fashion">
        <OffersPageClient initialSettings={ajustes()} initialOffers={[oferta('p1', 'Remera', 100, 50, { image: 'https://cdn.test/r.jpg' })] as never} />
      </StorefrontStyleProvider>
    )
    expect(container.querySelector('article a')).toHaveClass('aspect-[3/4]')
  })
})

describe('la paginación', () => {
  it('muestra de a 24 y pasa de página', () => {
    const muchas = Array.from({ length: 30 }, (_, i) => oferta(`p${i}`, `Producto ${i}`, 100, 50))
    pintar(muchas)
    expect(tarjetas()).toHaveLength(24)

    fireEvent.click(screen.getByRole('button', { name: 'Página 2' }))
    expect(tarjetas()).toHaveLength(6)
    expect(screen.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
  })

  it('con muchas páginas, los números se acortan', () => {
    expect(paginationItems(1, 3)).toEqual([1, 2, 3])
    expect(paginationItems(1, 12)).toEqual([1, 2, 'gap', 12])
    expect(paginationItems(6, 12)).toEqual([1, 'gap', 5, 6, 7, 'gap', 12])
    expect(paginationItems(12, 12)).toEqual([1, 'gap', 11, 12])
  })
})

describe('sin ofertas', () => {
  it('con la sección apagada lo dice y lleva al catálogo', () => {
    const settings = ajustes()
    settings.offers_section.enabled = false
    pintar([oferta('p1', 'Remera', 100, 50)], settings)
    expect(screen.getByRole('heading', { name: 'Ofertas no disponibles' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ver todos los productos/ })).toHaveAttribute('href', '/tienda-demo/productos')
  })

  it('sin ofertas activas no muestra filtros vacíos', () => {
    pintar([])
    expect(screen.getByRole('status')).toHaveTextContent('No hay ofertas activas')
    expect(screen.queryByRole('textbox', { name: 'Buscar en ofertas' })).not.toBeInTheDocument()
  })
})

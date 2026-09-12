import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const control = vi.hoisted(() => ({ addProduct: vi.fn(() => ({ limited: false, quantity: 1 })) }))

vi.mock('@/hooks/use-public-cart', () => ({ usePublicCart: () => ({ addProduct: control.addProduct }) }))
vi.mock('@/hooks/useWebsiteSettings', () => ({
  useWebsiteSettings: () => ({
    settings: { checkout: { commerceMode: 'cart' }, company_info: { name: 'DA', whatsapp: '595981123456' } },
    isLoading: false,
    error: null,
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

import { OFFER_ACCENTS, OffersCarouselDeck, type OfferSlide } from '@/components/public/offers/OffersCarouselDeck'
import { mapProductsToOfferSlides } from '@/components/public/inicio/OffersCarousel'
import type { OfferDetailProduct } from '@/components/public/offers/OfferDetailModal'

const accent = OFFER_ACCENTS.rose

const producto = (extra: Partial<OfferDetailProduct> = {}): OfferDetailProduct => ({
  id: 'p1',
  name: 'Remera Básica Oversize',
  brand: 'DA',
  description: 'Algodón peinado 24/1.',
  sale_price: 69_000,
  offer_price: 58_650,
  has_offer: true,
  in_stock: true,
  stock_quantity: 5,
  featured: false,
  image: 'https://cdn.test/remera.jpg',
  images: ['https://cdn.test/remera.jpg'],
  category: { id: 'c1', name: 'Remeras' },
  created_at: null,
  ...extra,
})

const slide = (extra: Partial<OfferSlide> = {}): OfferSlide => ({
  id: 'p1',
  title: 'Remera Básica Oversize',
  description: 'Algodón peinado 24/1.',
  priceLabel: 'Gs. 58.650',
  originalPriceLabel: 'Gs. 69.000',
  tag: '-15% OFF',
  ctaHref: '/productos/p1',
  image: 'https://cdn.test/remera.jpg',
  brand: 'DA',
  inStock: true,
  offerPrice: 58_650,
  salePrice: 69_000,
  product: producto(),
  ...extra,
})

const pintar = (offers: OfferSlide[]) =>
  render(
    <OffersCarouselDeck
      offers={offers}
      accent={accent}
      fallbackBrand="DA"
      tenantPrefix="/tienda-demo"
      autoplay={false}
    />
  )

beforeEach(() => control.addProduct.mockClear())

describe('el inicio manda el producto completo a las ofertas', () => {
  it('el slide lleva descripción, galería y variantes, no solo el precio', () => {
    const [mapped] = mapProductsToOfferSlides([
      {
        id: 'p1',
        name: 'Remera',
        description: 'Algodón peinado',
        sale_price: 69_000,
        offer_price: 58_650,
        has_offer: true,
        stock_quantity: 4,
        images: ['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg'],
        has_variants: true,
        variant_attribute_config: [{ key: 'talle', label: 'Talle', control: 'select', options: ['M', 'L'] }],
        variants: [
          { id: 'v1', product_id: 'p1', variant_name: 'M', attributes: { talle: 'M' }, sku: null, sale_price: 69_000, stock_quantity: 2, is_active: true },
        ],
      },
    ])

    expect(mapped.product).toMatchObject({
      id: 'p1',
      description: 'Algodón peinado',
      in_stock: true,
      stock_quantity: 4,
      has_variants: true,
    })
    expect(mapped.product?.images).toHaveLength(2)
    expect(mapped.product?.variants).toHaveLength(1)
  })
})

describe('el detalle de una oferta destacada', () => {
  it('la foto abre el modal sin salir de la página', () => {
    pintar([slide()])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: 'Ver detalle de Remera Básica Oversize' }))

    const modal = within(screen.getByRole('dialog'))
    expect(modal.getAllByRole('heading', { name: 'Remera Básica Oversize' }).length).toBeGreaterThan(0)
    expect(modal.getByText('Gs. 58.650')).toBeInTheDocument()
    expect(modal.getByText('Algodón peinado 24/1.')).toBeInTheDocument()
  })

  it('«Ver» también lo abre, y desde el modal se puede ir a la página completa', () => {
    pintar([slide()])
    fireEvent.click(screen.getByRole('link', { name: 'Ver' }))

    const modal = within(screen.getByRole('dialog'))
    expect(modal.getByRole('link', { name: /Ver página completa/ })).toHaveAttribute('href', '/tienda-demo/productos/p1')
  })

  it('desde el modal se agrega al carrito al precio de oferta', () => {
    pintar([slide()])
    fireEvent.click(screen.getByRole('link', { name: 'Ver' }))

    const modal = within(screen.getByRole('dialog'))
    fireEvent.click(modal.getByRole('button', { name: /Agregar al carrito/ }))
    expect(control.addProduct).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }), 58_650, 1)
  })

  it('con variantes, primero hay que elegirlas', () => {
    pintar([
      slide({
        product: producto({
          has_variants: true,
          variant_attribute_config: [{ key: 'talle', label: 'Talle', control: 'select', options: ['M', 'L'] }],
          variants: [
            { id: 'v1', product_id: 'p1', variant_name: 'M', attributes: { talle: 'M' }, sku: null, sale_price: 69_000, stock_quantity: 2, is_active: true },
          ],
        }),
      }),
    ])
    fireEvent.click(screen.getByRole('link', { name: 'Ver' }))

    const modal = within(screen.getByRole('dialog'))
    expect(modal.getByRole('button', { name: /Seleccioná las variantes/ })).toBeDisabled()
    fireEvent.click(modal.getByRole('button', { name: 'M' }))
    expect(modal.getByRole('button', { name: /Agregar al carrito/ })).toBeEnabled()
  })

  it('con Ctrl+clic abre la página completa en vez del modal', () => {
    pintar([slide()])
    fireEvent.click(screen.getByRole('link', { name: 'Ver' }), { ctrlKey: true })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('una oferta sin datos completos sigue siendo un enlace, como antes', () => {
    pintar([slide({ product: undefined })])
    const ver = screen.getByRole('link', { name: 'Ver' })
    expect(ver).toHaveAttribute('href', '/tienda-demo/productos/p1')

    fireEvent.click(ver)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

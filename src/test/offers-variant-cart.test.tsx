import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { Profiler } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const control = vi.hoisted(() => ({
  addProduct: vi.fn(() => ({ limited: false, quantity: 1 })),
  info: vi.fn(),
}))

vi.mock('@/hooks/use-public-cart', () => ({ usePublicCart: () => ({ addProduct: control.addProduct }) }))
vi.mock('@/hooks/useWebsiteSettings', () => ({
  useWebsiteSettings: () => ({
    settings: { checkout: { commerceMode: 'cart' }, company_info: { name: 'DA' } },
    isLoading: false,
    error: null,
  }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: control.info } }))
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, src }: { alt?: string; src?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}))

import { OFFER_ACCENTS, OffersCarouselDeck, type OfferSlide } from '@/components/public/offers/OffersCarouselDeck'
import { OfferDetailModal, type OfferDetailProduct } from '@/components/public/offers/OfferDetailModal'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

const conVariantes: OfferDetailProduct = {
  id: 'p1',
  name: 'Remera Básica',
  brand: 'DA',
  description: null,
  sale_price: 69_000,
  offer_price: 58_650,
  has_offer: true,
  in_stock: true,
  stock_quantity: 6,
  featured: false,
  image: null,
  images: null,
  created_at: null,
  has_variants: true,
  variant_attribute_config: [{ key: 'size', label: 'Talle', control: 'select', options: ['M', 'L'] }],
  variants: [
    { id: 'v1', product_id: 'p1', variant_name: 'M', attributes: { size: 'M' }, sku: 'REM-M', sale_price: 69_000, stock_quantity: 4, is_active: true },
    { id: 'v2', product_id: 'p1', variant_name: 'L', attributes: { size: 'L' }, sku: 'REM-L', sale_price: 79_000, stock_quantity: 2, is_active: true },
  ],
}

const slide = (product: OfferDetailProduct | undefined): OfferSlide => ({
  id: 'p1',
  title: product?.name ?? 'Remera Básica',
  description: 'Algodón peinado.',
  priceLabel: 'Gs. 58.650',
  tag: '-15% OFF',
  ctaHref: '/productos/p1',
  image: null,
  brand: 'DA',
  inStock: true,
  offerPrice: 58_650,
  salePrice: 69_000,
  product,
})

beforeEach(() => {
  control.addProduct.mockClear()
  control.info.mockClear()
})

/**
 * El pedido rechaza una linea sin variante («Elegí nuevamente la variante»).
 * Las ofertas agregaban a ciegas desde la tarjeta y desde el carrusel, y el
 * modal ni siquiera mandaba la variante que el cliente acababa de elegir.
 */
describe('agregar una oferta con variantes al carrito', () => {
  it('actualiza la foto de la variante sin un render extra de sincronización', () => {
    const commits: number[] = []
    const product = {
      ...conVariantes,
      image: '/remera.jpg',
      variants: conVariantes.variants?.map((variant) => ({
        ...variant,
        attributes: {
          ...variant.attributes,
          image_url: variant.id === 'v2' ? '/remera-l.jpg' : '/remera-m.jpg',
        },
      })),
    }

    render(
      <Profiler id="detalle-oferta" onRender={() => commits.push(1)}>
        <OfferDetailModal
          offer={product}
          isOpen
          onClose={vi.fn()}
          tenantPrefix="/tienda-demo"
          commerceMode="cart"
          contactPhone=""
        />
      </Profiler>
    )

    const before = commits.length
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'L' }))

    expect(screen.getByRole('img', { name: 'Remera Básica' })).toHaveAttribute('src', '/remera-l.jpg')
    expect(commits.length - before).toBeLessThanOrEqual(2)
  })

  it('no reinicia la galería al tocar otra vez el talle ya elegido', () => {
    const product = {
      ...conVariantes,
      image: '/remera.jpg',
      variants: conVariantes.variants?.map((variant) => ({
        ...variant,
        attributes: { ...variant.attributes, image_url: '/remera-l.jpg' },
      })),
    }
    render(
      <OfferDetailModal
        offer={product}
        isOpen
        onClose={vi.fn()}
        tenantPrefix="/tienda-demo"
        commerceMode="cart"
        contactPhone=""
      />
    )
    const modal = within(screen.getByRole('dialog'))
    fireEvent.click(modal.getByRole('button', { name: 'L' }))
    fireEvent.click(modal.getByRole('button', { name: 'Ver imagen 1' }))
    expect(modal.getByRole('img', { name: 'Remera Básica' })).toHaveAttribute('src', '/remera.jpg')

    fireEvent.click(modal.getByRole('button', { name: 'L' }))
    expect(modal.getByRole('img', { name: 'Remera Básica' })).toHaveAttribute('src', '/remera.jpg')
  })

  it('desde el modal se manda la variante elegida', () => {
    render(
      <OfferDetailModal
        offer={conVariantes}
        isOpen
        onClose={vi.fn()}
        tenantPrefix="/tienda-demo"
        commerceMode="cart"
        contactPhone=""
      />
    )

    const modal = within(screen.getByRole('dialog'))
    fireEvent.click(modal.getByRole('button', { name: 'L' }))
    fireEvent.click(modal.getByRole('button', { name: /Agregar al carrito/ }))

    // La L vale 79.000 y la oferta del producto es del 15%: 67.150.
    expect(control.addProduct).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1' }),
      67_150,
      1,
      expect.objectContaining({ id: 'v2', variant_name: 'L' })
    )
  })

  it('desde el carrusel se abre el detalle en vez de agregar a ciegas', () => {
    render(
      <OffersCarouselDeck
        offers={[slide(conVariantes)]}
        accent={OFFER_ACCENTS.rose}
        fallbackBrand="DA"
        tenantPrefix="/tienda-demo"
        autoplay={false}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Agregar Remera Básica al carrito/ }))

    expect(control.addProduct).not.toHaveBeenCalled()
    expect(control.info).toHaveBeenCalledWith('Elegí una variante para continuar.')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('un producto sin variantes se sigue agregando de una', () => {
    const simple = { ...conVariantes, has_variants: false, variants: undefined, variant_attribute_config: undefined }
    render(
      <OffersCarouselDeck
        offers={[slide(simple)]}
        accent={OFFER_ACCENTS.rose}
        fallbackBrand="DA"
        tenantPrefix="/tienda-demo"
        autoplay={false}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Agregar Remera Básica al carrito/ }))
    expect(control.addProduct).toHaveBeenCalledTimes(1)
    // Y con el stock real, no con el 99 inventado de antes.
    expect(control.addProduct.mock.calls[0][0]).toMatchObject({ stock_quantity: 6 })
  })
})

describe('la grilla de /ofertas', () => {
  it('con variantes abre el detalle antes de agregar', () => {
    const fuente = leer('src/app/(public)/ofertas/OffersPageClient.tsx')
    expect(fuente).toContain('if (offer.has_variants) {')
    expect(fuente).toContain("toast.info('Elegí una variante para continuar.')")
  })
})

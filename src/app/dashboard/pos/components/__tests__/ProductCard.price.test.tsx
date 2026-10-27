import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Product } from '@/types/product-unified'
import { resolveProductCardPrice } from '../../lib/card-price'
import { priceCartLine, getActiveOfferPrice } from '../../lib/cart-pricing'
import { ProductCard } from '../ProductCard'
import { GRID_ROW_ESTIMATE, VirtualizedProductGrid } from '../VirtualizedProductList'

const formatGs = (amount: number) => `Gs. ${amount.toLocaleString('es-PY')}`

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-1',
    name: 'Funda',
    sku: 'F-1',
    sale_price: 100_000,
    purchase_price: 50_000,
    stock_quantity: 5,
    is_active: true,
    ...overrides,
  } as Product
}

describe('precio de la tarjeta del POS', () => {
  it('con oferta muestra lo que cobra el carrito y tacha el de lista', () => {
    const product = makeProduct({ has_offer: true, offer_price: 80_000 } as Partial<Product>)
    const price = resolveProductCardPrice(product, { isWholesale: false })
    const charged = priceCartLine({ price: 100_000, quantity: 1, offerPrice: getActiveOfferPrice(product) }, { isWholesale: false, fractionDigits: 0 })
    expect(price).toEqual({ price: 80_000, listPrice: 100_000, fromVariants: false, isOffer: true })
    expect(price.price).toBe(charged.net)

    render(<ProductCard product={product} addToCart={vi.fn()} formatCurrency={formatGs} />)
    expect(screen.getByText('OFERTA')).toBeInTheDocument()
    expect(screen.getByText('Gs. 80.000')).toBeInTheDocument()
    expect(screen.getByText('Gs. 100.000')).toHaveClass('line-through')
  })

  it('una oferta apagada o que no baja el precio no se muestra', () => {
    expect(resolveProductCardPrice(makeProduct({ has_offer: false, offer_price: 80_000 } as Partial<Product>), { isWholesale: false }))
      .toMatchObject({ price: 100_000, listPrice: null, isOffer: false })
    expect(resolveProductCardPrice(makeProduct({ has_offer: true, offer_price: 120_000 } as Partial<Product>), { isWholesale: false }))
      .toMatchObject({ price: 100_000, listPrice: null, isOffer: false })
  })

  it('en mayorista no aplica la oferta minorista, igual que el carrito', () => {
    const product = makeProduct({ has_offer: true, offer_price: 80_000, wholesale_price: 90_000 } as Partial<Product>)
    expect(resolveProductCardPrice(product, { isWholesale: true })).toMatchObject({ price: 90_000, listPrice: 100_000, isOffer: false })
    expect(resolveProductCardPrice(makeProduct(), { isWholesale: true, wholesaleDiscountRate: 10 })).toMatchObject({ price: 90_000 })
  })

  it('con variantes de distinto precio muestra «Desde» el más barato activo', () => {
    const product = makeProduct({
      sale_price: 0,
      has_variants: true,
      variants: [
        { id: 'a', sku: 'A', attributes: {}, sale_price: 150_000, is_active: true },
        { id: 'b', sku: 'B', attributes: {}, sale_price: 120_000, is_active: true },
        { id: 'c', sku: 'C', attributes: {}, sale_price: 50_000, is_active: false },
      ],
    } as Partial<Product>)
    expect(resolveProductCardPrice(product, { isWholesale: false })).toEqual({ price: 120_000, listPrice: null, fromVariants: true, isOffer: false })

    render(<ProductCard product={product} addToCart={vi.fn()} formatCurrency={formatGs} />)
    expect(screen.getByText('Desde')).toBeInTheDocument()
    expect(screen.getByText('Gs. 120.000')).toBeInTheDocument()
    expect(screen.queryByText('Gs. 0')).not.toBeInTheDocument()
  })

  it('las variantes heredan la oferta en proporción', () => {
    const product = makeProduct({
      has_offer: true,
      offer_price: 80_000,
      has_variants: true,
      variants: [{ id: 'a', sku: 'A', attributes: {}, sale_price: 200_000, is_active: true }],
    } as Partial<Product>)
    expect(resolveProductCardPrice(product, { isWholesale: false })).toMatchObject({ price: 160_000, listPrice: 200_000, isOffer: true, fromVariants: false })
  })
})

describe('grilla virtualizada del POS', () => {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
  afterEach(() => {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', descriptor)
    vi.unstubAllGlobals()
  })
  // jsdom no mide: este observer avisa en cuanto se observa un elemento, como el navegador.
  class MeasuringResizeObserver {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe() { queueMicrotask(() => this.callback([], this as unknown as ResizeObserver)) }
    unobserve() {}
    disconnect() {}
  }

  // Antes la fila medía 280 px fijos y la siguiente tapaba el precio de las
  // tarjetas más altas (nombre largo + stock + cuotas).
  it('agranda la fila cuando las tarjetas miden más que la estimación', async () => {
    vi.stubGlobal('ResizeObserver', MeasuringResizeObserver)
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get(this: HTMLElement) { return this.dataset.testid === 'pos-virtual-row' ? 420 : 0 },
    })
    const products = Array.from({ length: 6 }, (_, index) => makeProduct({ id: `p-${index}`, name: `Producto ${index}` }))
    render(
      <VirtualizedProductGrid
        products={products}
        onAddToCart={vi.fn()}
        getCartQuantity={() => 0}
        height={800}
      />,
    )
    await act(async () => {})
    const rows = screen.getAllByTestId('pos-virtual-row').map((row) => row.parentElement as HTMLElement)
    expect(GRID_ROW_ESTIMATE).toBeLessThan(420)
    expect(GRID_ROW_ESTIMATE).toBeGreaterThan(280)
    for (const row of rows) expect(row.style.height).toBe('420px')
    // Las filas no se superponen: cada una arranca donde termina la anterior.
    const tops = rows.map((row) => parseInt(row.style.top, 10)).sort((a, b) => a - b)
    for (let index = 1; index < tops.length; index++) expect(tops[index] - tops[index - 1]).toBe(420)
  })

  it('respeta la vista de lista: una tarjeta por fila', () => {
    const products = Array.from({ length: 3 }, (_, index) => makeProduct({ id: `l-${index}`, name: `Lista ${index}` }))
    render(<VirtualizedProductGrid products={products} viewMode="list" onAddToCart={vi.fn()} getCartQuantity={() => 0} height={800} />)
    for (const row of screen.getAllByTestId('pos-virtual-row')) {
      expect(row.style.gridTemplateColumns).toBe('repeat(1, minmax(0, 1fr))')
    }
  })
})

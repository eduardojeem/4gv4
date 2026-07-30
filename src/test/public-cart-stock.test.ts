import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addPublicProductToCart,
  getPublicCartItems,
  setPublicCartItemStock,
} from '@/lib/public-cart'
import type { PublicProduct } from '@/types/public'

const product: PublicProduct = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Producto limitado',
  sku: 'LIMIT-1',
  description: null,
  brand: null,
  sale_price: 120000,
  wholesale_price: null,
  stock_quantity: 1,
  in_stock: true,
  is_active: true,
  featured: false,
  image: null,
  images: null,
  unit_measure: 'unidad',
  barcode: null,
}

describe('public cart stock limits', () => {
  let stored = ''

  beforeEach(() => {
    stored = ''
    vi.mocked(window.localStorage.getItem).mockImplementation(() => stored || null)
    vi.mocked(window.localStorage.setItem).mockImplementation((_key, value) => {
      stored = value
    })
  })

  it('does not add more units than the product stock', () => {
    addPublicProductToCart({
      tenantSlug: 'tienda',
      product,
      unitPrice: product.sale_price,
      quantity: 1,
    })

    const result = addPublicProductToCart({
      tenantSlug: 'tienda',
      product,
      unitPrice: product.sale_price,
      quantity: 2,
    })

    expect(result.limited).toBe(true)
    expect(result.quantity).toBe(1)
    expect(getPublicCartItems('tienda')).toEqual([
      expect.objectContaining({
        productId: product.id,
        quantity: 1,
        availableStock: 1,
      }),
    ])
  })

  it('reconciles a saved cart when the server reports lower stock', () => {
    stored = JSON.stringify([{
      productId: product.id,
      name: product.name,
      sku: product.sku,
      image: null,
      unitPrice: product.sale_price,
      quantity: 3,
      availableStock: 3,
    }])

    const next = setPublicCartItemStock('tienda', product.id, 1)

    expect(next).toEqual(expect.objectContaining({ quantity: 1, availableStock: 1 }))
    expect(getPublicCartItems('tienda')[0]).toEqual(expect.objectContaining({
      quantity: 1,
      availableStock: 1,
    }))
  })

  it('keeps legacy saved carts readable until the server validates them', () => {
    stored = JSON.stringify([{
      productId: product.id,
      name: product.name,
      sku: product.sku,
      image: null,
      unitPrice: product.sale_price,
      quantity: 2,
    }])

    expect(getPublicCartItems('tienda')[0]).toEqual(expect.objectContaining({
      quantity: 2,
      availableStock: null,
    }))
  })
})

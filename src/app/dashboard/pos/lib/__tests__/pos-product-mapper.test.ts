import { describe, expect, it } from 'vitest'
import { mapProductForPOS } from '../pos-product-mapper'

describe('mapProductForPOS', () => {
  it('preserves the configured wholesale price used by the POS', () => {
    const product = mapProductForPOS({
      id: 'product-1',
      name: 'Pantalla',
      sku: 'PANT-1',
      sale_price: 150000,
      wholesale_price: 120000,
      stock_quantity: 5,
      category_id: 'category-1',
      categories: { name: 'Repuestos' },
      brand: 'Samsung',
      images: ['/pantalla.jpg'],
      is_active: true,
    })

    expect(product.sale_price).toBe(150000)
    expect(product.wholesale_price).toBe(120000)
    expect(product.category).toMatchObject({ id: 'category-1', name: 'Repuestos' })
    expect(product.brand).toBe('Samsung')
    expect(product.image).toBe('/pantalla.jpg')
  })

  it('keeps a missing wholesale price as null so the fallback remains explicit', () => {
    const product = mapProductForPOS({
      id: 'product-2',
      name: 'Cable',
      sku: 'CAB-1',
      sale_price: 50000,
      wholesale_price: null,
      stock_quantity: 10,
      category_id: null,
      is_active: true,
    })

    expect(product.wholesale_price).toBeNull()
  })
})

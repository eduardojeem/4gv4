import { describe, expect, it } from 'vitest'
import { productSchema } from './schemas'

const validProduct = {
  name: 'Producto de prueba',
  sku: 'PROD-001',
  category_id: '11111111-1111-4111-8111-111111111111',
  purchase_price: 100,
  sale_price: 150,
  stock_quantity: 0,
  min_stock: 0,
}

describe('productSchema', () => {
  it('accepts the null description produced by the product modal', () => {
    const result = productSchema.safeParse({
      ...validProduct,
      description: null,
    })

    expect(result.success).toBe(true)
  })
})

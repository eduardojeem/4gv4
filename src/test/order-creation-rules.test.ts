import { describe, expect, it } from 'vitest'
import {
  getCatalogUnitPrice,
  hasDuplicateProductIds,
  validateDeliveryContact,
  validateOrderAmounts,
} from '@/lib/orders/creation-rules'

describe('order creation rules', () => {
  it('uses the active catalog offer instead of a client-provided price', () => {
    expect(getCatalogUnitPrice({ sale_price: 150000, offer_price: 120000 })).toBe(120000)
    expect(getCatalogUnitPrice({ sale_price: 150000, offer_price: 0 })).toBe(150000)
  })

  it('rejects duplicate products', () => {
    expect(hasDuplicateProductIds([{ productId: 'a' }, { productId: 'a' }])).toBe(true)
    expect(hasDuplicateProductIds([{ productId: 'a' }, { productId: 'b' }])).toBe(false)
  })

  it('rejects pickup shipping and discounts above the subtotal', () => {
    expect(validateOrderAmounts({
      subtotal: 100000,
      shippingCost: 5000,
      discountAmount: 0,
      fulfillmentType: 'PICKUP',
    })).toContain('retiro')

    expect(validateOrderAmounts({
      subtotal: 100000,
      shippingCost: 5000,
      discountAmount: 100001,
      fulfillmentType: 'DELIVERY',
    })).toContain('descuento')
  })

  it('requires phone and address only for delivery orders', () => {
    expect(validateDeliveryContact({ fulfillmentType: 'PICKUP' })).toBeNull()
    expect(validateDeliveryContact({ fulfillmentType: 'DELIVERY', address: 'Centro' })).toContain('teléfono')
    expect(validateDeliveryContact({ fulfillmentType: 'DELIVERY', phone: '0981 000 000' })).toContain('dirección')
    expect(validateDeliveryContact({
      fulfillmentType: 'DELIVERY',
      phone: '0981 000 000',
      address: 'Centro',
    })).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { cartSyncInputSchema, mergeCartItems } from './cart-sync'

const productId = '11111111-1111-4111-8111-111111111111'

describe('marketplace cart sync contract', () => {
  it('does not duplicate an item already present remotely', () => {
    const item = { productId, variantId: null, quantity: 2 }
    expect(mergeCartItems([item], [item])).toEqual([item])
  })

  it('keeps variants as independent items', () => {
    const first = { productId, variantId: '22222222-2222-4222-8222-222222222222', quantity: 1 }
    const second = { productId, variantId: '33333333-3333-4333-8333-333333333333', quantity: 1 }
    expect(mergeCartItems([first], [second])).toHaveLength(2)
  })

  it('rejects invalid quantities and unknown fields', () => {
    expect(cartSyncInputSchema.safeParse({ organizationSlug: 'tienda', items: [{ productId, variantId: null, quantity: 0 }] }).success).toBe(false)
    expect(cartSyncInputSchema.safeParse({ organizationSlug: 'tienda', items: [], userId: productId }).success).toBe(false)
  })
})

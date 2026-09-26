import { describe, expect, it } from 'vitest'
import { compactPendingOperations, mergeForMigration } from './cart-sync-client'
import type { PublicCartItem } from '@/lib/public-cart'

const localItem = (quantity: number): PublicCartItem => ({
  cartItemId: 'p1', productId: '00000000-0000-4000-8000-000000000001', variantId: null,
  variantName: null, name: 'Producto', sku: null, image: null, unitPrice: 100, quantity, availableStock: 10,
})

describe('marketplace cart sync client', () => {
  it('migrates the same local and remote item without doubling quantity', () => {
    expect(mergeForMigration([localItem(2)], [{ productId: localItem(2).productId, variantId: null, quantity: 2 }]))
      .toEqual([{ productId: localItem(2).productId, variantId: null, quantity: 2 }])
  })

  it('keeps only the latest pending quantity per item', () => {
    const base = { organizationSlug: 'tienda', item: { productId: localItem(1).productId, variantId: null, quantity: 1 } }
    expect(compactPendingOperations([base, { ...base, item: { ...base.item, quantity: 3 } }]))
      .toEqual([{ ...base, item: { ...base.item, quantity: 3 } }])
  })
})

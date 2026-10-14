import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
import { revalidatePath, revalidateTag } from 'next/cache'
import { hasPublicProductChange, invalidateMarketplaceCatalog, samePublicValue } from './cache-invalidation'

describe('public cache invalidation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ignores object key order but preserves array order', () => {
    expect(samePublicValue({ a: 1, nested: { b: 2, c: 3 } }, { nested: { c: 3, b: 2 }, a: 1 })).toBe(true)
    expect(samePublicValue(['a', 'b'], ['b', 'a'])).toBe(false)
  })

  it('does not invalidate public output for internal cost or stock thresholds', () => {
    expect(hasPublicProductChange({ purchase_price: 10 }, { purchase_price: 20, min_stock: 3 })).toBe(false)
    expect(hasPublicProductChange({ name: 'Funda', images: ['a'] }, { name: 'Funda', images: ['a'] })).toBe(false)
  })

  it('detects price, stock, visibility and variant changes conservatively', () => {
    for (const patch of [{ sale_price: 200 }, { stock_quantity: 0 }, { visibility: 'private' }, { variants: [] }, { hide_price: true }]) {
      expect(hasPublicProductChange({ sale_price: 100, stock_quantity: 2, visibility: 'public', hide_price: false }, patch)).toBe(true)
    }
    // Parent rows do not contain variant rows: a submitted variant list is always refreshed.
    expect(hasPublicProductChange({ variants: [] }, { variants: [] })).toBe(true)
  })

  it('refreshes aggregate consumers, including embedded storefront products, without invalidating a layout', () => {
    invalidateMarketplaceCatalog()
    expect(vi.mocked(revalidateTag).mock.calls.map(call => call[0])).toEqual([
      'marketplace:products', 'marketplace:offers', 'marketplace:categories', 'marketplace:brands', 'marketplace:organizations',
    ])
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

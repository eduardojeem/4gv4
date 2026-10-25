import { describe, expect, it } from 'vitest'
import { productCostDraft, productCostPatch } from '../../mobile/src/lib/product-cost-input'

describe('mobile product cost integrity', () => {
  it('keeps an unknown cost distinct from a legitimate zero', () => {
    expect(productCostDraft(undefined)).toBeNull()
    expect(productCostDraft(null)).toBeNull()
    expect(productCostDraft(0)).toBe('0')
  })

  it('omits hidden and empty costs when changing only the name', () => {
    expect(productCostPatch(null, undefined, true)).toEqual({})
    expect(productCostPatch('', undefined, true)).toEqual({})
  })

  it('does not resubmit an unchanged known cost', () => {
    expect(productCostPatch('25.000', 25_000, true)).toEqual({})
  })

  it('sends an explicit zero and an edited cost with write permission', () => {
    expect(productCostPatch('0', 25_000, true)).toEqual({ purchase_price: 0 })
    expect(productCostPatch('30.000', 25_000, true)).toEqual({ purchase_price: 30_000 })
  })

  it('never sends cost fields without cost write permission', () => {
    expect(productCostPatch('0', 25_000, false)).toEqual({})
    expect(productCostPatch('30.000', undefined, false)).toEqual({})
  })
})

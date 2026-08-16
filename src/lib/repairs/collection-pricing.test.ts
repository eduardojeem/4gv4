import { describe, expect, it } from 'vitest'
import { resolveRepairCollectionPricing } from './collection-pricing'

describe('resolveRepairCollectionPricing', () => {
  it('uses the persisted estimate for a legacy automatic repair without details', () => {
    const result = resolveRepairCollectionPricing({
      mode: 'automatic',
      laborCost: 0,
      finalCost: null,
      estimatedCost: 600_000,
      paidAmount: 100_000,
      parts: [],
    })

    expect(result.reconciledLegacyPrice).toBe(true)
    expect(result.pricing).toMatchObject({
      mode: 'budget',
      customerTotal: 600_000,
      paidAmount: 100_000,
      balance: 500_000,
    })
  })

  it('does not replace a valid automatic breakdown with an estimate', () => {
    const result = resolveRepairCollectionPricing({
      mode: 'automatic',
      laborCost: 100_000,
      estimatedCost: 600_000,
      parts: [],
    })

    expect(result.reconciledLegacyPrice).toBe(false)
    expect(result.pricing.customerTotal).toBe(100_000)
  })

  it('does not revive an automatic total reduced to zero by a discount', () => {
    const result = resolveRepairCollectionPricing({
      mode: 'automatic',
      laborCost: 100_000,
      discountAmount: 100_000,
      estimatedCost: 600_000,
      parts: [],
    })

    expect(result.reconciledLegacyPrice).toBe(false)
    expect(result.pricing.customerTotal).toBe(0)
  })

  it('does not revive a legacy amount that is already covered', () => {
    const result = resolveRepairCollectionPricing({
      mode: 'automatic',
      laborCost: 0,
      estimatedCost: 600_000,
      paidAmount: 600_000,
      parts: [],
    })

    expect(result.reconciledLegacyPrice).toBe(false)
    expect(result.pricing.balance).toBe(0)
  })
})

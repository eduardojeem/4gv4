import { describe, expect, it } from 'vitest'
import { calculateRepairPricing, validateRepairPricing } from './pricing'

describe('calculateRepairPricing', () => {
  it('uses charged part prices, not internal inventory costs', () => {
    const result = calculateRepairPricing({
      laborCost: 100_000,
      parts: [{ cost: 150_000, internalCost: 90_000, quantity: 2 }],
    })

    expect(result.laborCost).toBe(100_000)
    expect(result.partsPrice).toBe(300_000)
    expect(result.partsInternalCost).toBe(180_000)
    expect(result.estimatedTotal).toBe(400_000)
  })

  it('normalizes invalid optional values to zero', () => {
    expect(calculateRepairPricing({
      laborCost: Number.NaN,
      parts: [{ cost: Number.NaN, quantity: 0 }],
    }).estimatedTotal).toBe(0)
  })

  it('derives the customer total in automatic mode and respects PYG precision', () => {
    const result = calculateRepairPricing({
      mode: 'automatic',
      currency: 'PYG',
      laborCost: 100_000.4,
      discountAmount: 10_000.2,
      parts: [{ cost: 200_000.4, internalCost: 120_000, quantity: 1 }],
    })

    expect(result.customerTotal).toBe(290_000)
    expect(result.laborCost).toBe(100_000)
    expect(result.partsInternalCost).toBe(120_000)
    expect(result.margin).toBe(170_000)
  })

  it('derives labor from an agreed budget', () => {
    const result = calculateRepairPricing({
      mode: 'budget',
      currency: 'USD',
      finalCost: 350,
      discountAmount: 25,
      parts: [{ cost: 200, internalCost: 100, quantity: 1 }],
    })

    expect(result.laborCost).toBe(175)
    expect(result.customerTotal).toBe(350)
    expect(result.balance).toBe(350)
  })

  it('reports invalid discount, negative derived labor and total below paid amount', () => {
    expect(validateRepairPricing({
      mode: 'automatic',
      laborCost: 10,
      discountAmount: 20,
      parts: [],
    })).toContain('DISCOUNT_EXCEEDS_SUBTOTAL')

    expect(validateRepairPricing({
      mode: 'budget',
      finalCost: 50,
      parts: [{ cost: 100, quantity: 1 }],
    })).toContain('FINAL_BELOW_PARTS_PRICE')

    expect(validateRepairPricing({
      mode: 'manual',
      finalCost: 80,
      paidAmount: 100,
      parts: [],
    })).toContain('FINAL_BELOW_PAID_AMOUNT')
  })
})

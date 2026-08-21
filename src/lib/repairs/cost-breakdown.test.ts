import { describe, expect, it } from 'vitest'
import { calculateRepairCost, validateRepairCost } from './cost-breakdown'

const baseInput = {
  currency: 'PYG',
  laborAmount: 110_000,
  laborTaxRate: 10 as const,
  parts: [
    {
      key: 'screen',
      quantity: 2,
      unitPrice: 55_000,
      unitCost: 40_000,
      discountAmount: 10_000,
      taxRate: 10 as const,
    },
    {
      key: 'cable',
      quantity: 1,
      unitPrice: 105_000,
      unitCost: 80_000,
      discountAmount: 0,
      taxRate: 5 as const,
    },
  ],
  additionalCharges: 5_000,
  deductions: 0,
  discountAmount: 20_000,
  paidAmount: 100_000,
}

describe('calculateRepairCost', () => {
  it('keeps VAT inside labor and mixed-rate parts', () => {
    const result = calculateRepairCost(baseInput)

    expect(result.laborAmount).toBe(110_000)
    expect(result.partsSubtotal).toBe(205_000)
    expect(result.subtotalBeforeDiscount).toBe(320_000)
    expect(result.finalTotal).toBe(300_000)
    expect(result.balance).toBe(200_000)
    expect(result.taxBreakdown.map((row) => row.rate)).toEqual([5, 10])
    expect(result.taxBreakdown.reduce((sum, row) => sum + row.grossAmount, 0)).toBe(300_000)
  })

  it('rounds PYG amounts and never returns a negative total or balance', () => {
    const result = calculateRepairCost({
      ...baseInput,
      laborAmount: 10_000.6,
      parts: [],
      additionalCharges: 0,
      discountAmount: 20_000,
      deductions: 2_000,
      paidAmount: 50_000,
    })

    expect(result.laborAmount).toBe(10_001)
    expect(result.finalTotal).toBe(0)
    expect(result.balance).toBe(0)
  })
})

describe('validateRepairCost', () => {
  it('requires an administrator and reason above the discount limit', () => {
    const input = { ...baseInput, discountAmount: 70_000 }

    expect(validateRepairCost(input, { maxDiscountPercent: 20, isAdmin: false }))
      .toContainEqual(expect.objectContaining({ code: 'DISCOUNT_LIMIT_EXCEEDED' }))
    expect(validateRepairCost(input, { maxDiscountPercent: 20, isAdmin: true }))
      .toContainEqual(expect.objectContaining({ code: 'OVERRIDE_REASON_REQUIRED' }))
    expect(validateRepairCost(input, {
      maxDiscountPercent: 20,
      isAdmin: true,
      overrideReason: 'Acuerdo comercial autorizado',
    })).not.toContainEqual(expect.objectContaining({ code: 'DISCOUNT_LIMIT_EXCEEDED' }))
  })

  it('blocks a below-cost part unless an administrator supplies a reason', () => {
    const input = {
      ...baseInput,
      parts: [{ ...baseInput.parts[0], unitPrice: 30_000, discountAmount: 0 }],
      discountAmount: 0,
    }

    expect(validateRepairCost(input, { maxDiscountPercent: 20, isAdmin: false }))
      .toContainEqual(expect.objectContaining({ code: 'PART_BELOW_COST', partKey: 'screen' }))
    expect(validateRepairCost(input, {
      maxDiscountPercent: 20,
      isAdmin: true,
      overrideReason: 'Liquidación de repuesto dañado',
    })).not.toContainEqual(expect.objectContaining({ code: 'PART_BELOW_COST' }))
  })

  it('reports invalid amounts, excessive row discounts and a total below payments', () => {
    const violations = validateRepairCost({
      ...baseInput,
      laborAmount: -1,
      paidAmount: 999_999,
      parts: [{ ...baseInput.parts[0], discountAmount: 999_999 }],
    }, { maxDiscountPercent: 20, isAdmin: false })

    expect(violations.map((item) => item.code)).toEqual(expect.arrayContaining([
      'NEGATIVE_AMOUNT',
      'PART_DISCOUNT_EXCEEDS_GROSS',
      'FINAL_BELOW_PAID_AMOUNT',
    ]))
  })
})

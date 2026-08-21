import { describe, expect, it } from 'vitest'

import {
  getFeaturedProductCreditPlan,
  getProductCreditPlans,
  hasProductCredit,
} from '../product-credit'

const product = {
  installments_enabled: true,
  installments_plans: [
    { count: 6, rate: 0 },
    { count: 12, rate: 12 },
    { count: 0, rate: 10 },
  ],
}

describe('product financing plans', () => {
  it('normalizes valid plans and calculates totals from the effective price', () => {
    expect(getProductCreditPlans(product, 1_200_000)).toMatchObject([
      { count: 6, rate: 0, installmentAmount: 200_000, financedTotal: 1_200_000 },
      { count: 12, rate: 12, installmentAmount: 112_000, financedTotal: 1_344_000 },
    ])
  })

  it('selects the highest installment count and then the lowest rate', () => {
    const tiedProduct = {
      installments_enabled: true,
      installments_plans: [
        { count: 12, rate: 20 },
        { count: 12, rate: 10 },
        { count: 6, rate: 0 },
      ],
    }

    expect(getFeaturedProductCreditPlan(tiedProduct, 1_200_000)).toMatchObject({
      count: 12,
      rate: 10,
    })
  })

  it('rejects disabled products and invalid plans', () => {
    expect(hasProductCredit({ ...product, installments_enabled: false })).toBe(false)
    expect(getProductCreditPlans({
      installments_enabled: true,
      installments_plans: [{ count: 61, rate: 0 }],
    }, 100_000)).toEqual([])
  })

  it('deduplicates plans and rejects invalid prices and rates', () => {
    const plans = {
      installments_enabled: true,
      installments_plans: [
        { count: 6, rate: 10 },
        { count: 6, rate: 10 },
        { count: 3, rate: -1 },
        { count: 9, rate: 101 },
      ],
    }

    expect(getProductCreditPlans(plans, 600_000)).toHaveLength(1)
    expect(getProductCreditPlans(plans, 0)).toEqual([])
  })
})

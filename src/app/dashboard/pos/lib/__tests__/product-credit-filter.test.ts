import { describe, expect, it } from 'vitest'

import { applyProductCreditFilter } from '../product-credit-filter'

const products = [
  {
    id: 'cash',
    sale_price: 300_000,
    installments_enabled: false,
    installments_plans: [],
  },
  {
    id: 'credit-12',
    sale_price: 1_200_000,
    installments_enabled: true,
    installments_plans: [{ count: 12, rate: 12 }],
  },
  {
    id: 'lowest-installment',
    sale_price: 300_000,
    installments_enabled: true,
    installments_plans: [{ count: 6, rate: 0 }],
  },
]

describe('product credit catalog filters', () => {
  it('keeps only financed products with at least the requested installments', () => {
    const result = applyProductCreditFilter(products, {
      creditOnly: true,
      minimumInstallments: 12,
      creditSort: null,
    })

    expect(result.map(product => product.id)).toEqual(['credit-12'])
  })

  it('orders by lowest installment without mutating the input', () => {
    const original = [...products]
    const result = applyProductCreditFilter(products, {
      creditOnly: true,
      minimumInstallments: 1,
      creditSort: 'installment_low',
    })

    expect(result[0].id).toBe('lowest-installment')
    expect(products).toEqual(original)
  })

  it('orders by rate, installment count and financed total', () => {
    expect(applyProductCreditFilter(products, {
      creditOnly: true,
      minimumInstallments: 1,
      creditSort: 'rate_low',
    })[0].id).toBe('lowest-installment')

    expect(applyProductCreditFilter(products, {
      creditOnly: true,
      minimumInstallments: 1,
      creditSort: 'installments_high',
    })[0].id).toBe('credit-12')

    expect(applyProductCreditFilter(products, {
      creditOnly: true,
      minimumInstallments: 1,
      creditSort: 'financed_total_low',
    })[0].id).toBe('lowest-installment')
  })
})

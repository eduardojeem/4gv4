import { describe, expect, it } from 'vitest'
import { sumMoneyByCurrency } from '@/lib/superadmin/money-totals'

describe('sumMoneyByCurrency', () => {
  it('keeps currencies separated', () => {
    expect(sumMoneyByCurrency([
      { amount: 100_000, currency: 'PYG' },
      { amount: 50_000, currency: 'pyg' },
      { amount: 20, currency: 'USD' },
    ])).toEqual([
      { currency: 'PYG', amount: 150_000 },
      { currency: 'USD', amount: 20 },
    ])
  })

  it('uses PYG when a legacy row has no currency', () => {
    expect(sumMoneyByCurrency([{ amount: 5_000, currency: null }])).toEqual([
      { currency: 'PYG', amount: 5_000 },
    ])
  })
})

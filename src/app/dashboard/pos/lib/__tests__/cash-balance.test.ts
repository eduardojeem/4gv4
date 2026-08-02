import { describe, expect, it } from 'vitest'
import { calculateExpectedCashBalance } from '../cash-balance'

describe('calculateExpectedCashBalance', () => {
  it('includes only physical cash sales', () => {
    expect(calculateExpectedCashBalance([
      { type: 'opening', amount: 100_000 },
      { type: 'sale', amount: 50_000, payment_method: 'cash' },
      { type: 'sale', amount: 80_000, payment_method: 'card' },
      { type: 'sale', amount: 30_000, payment_method: 'transfer' },
      { type: 'cash_in', amount: 10_000 },
      { type: 'cash_in', amount: 40_000, payment_method: 'card' },
      { type: 'cash_out', amount: 5_000 },
    ])).toBe(155_000)
  })

  it('treats legacy sales without a payment method as cash', () => {
    expect(calculateExpectedCashBalance([
      { type: 'opening', amount: 0 },
      { type: 'sale', amount: 25_000 },
    ])).toBe(25_000)
  })
})

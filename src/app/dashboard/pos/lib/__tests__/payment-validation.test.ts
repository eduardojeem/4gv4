import { describe, expect, it } from 'vitest'

import { getMixedPaymentValidation } from '../payment-validation'

describe('getMixedPaymentValidation', () => {
  it('requires at least one payment', () => {
    expect(getMixedPaymentValidation(100, [])).toMatchObject({ valid: false, code: 'PAYMENTS_REQUIRED' })
  })

  it('rejects both missing amounts and overpayments', () => {
    expect(getMixedPaymentValidation(100, [{ method: 'cash', amount: 80 }])).toMatchObject({
      valid: false,
      code: 'PAYMENT_INCOMPLETE',
      remaining: 20,
    })
    expect(getMixedPaymentValidation(100, [{ method: 'cash', amount: 120 }])).toMatchObject({
      valid: false,
      code: 'PAYMENT_EXCESS',
      remaining: -20,
    })
  })

  it('rejects invalid electronic details and more than ten splits', () => {
    expect(getMixedPaymentValidation(100, [{ method: 'transfer', amount: 100 }])).toMatchObject({
      valid: false,
      code: 'TRANSFER_REFERENCE_REQUIRED',
    })
    expect(getMixedPaymentValidation(100, Array.from({ length: 11 }, () => ({
      method: 'cash' as const,
      amount: 100 / 11,
    })))).toMatchObject({ valid: false, code: 'PAYMENT_LIMIT_EXCEEDED' })
  })

  it('accepts an exact valid mixed payment', () => {
    expect(getMixedPaymentValidation(100, [
      { method: 'cash', amount: 40 },
      { method: 'card', amount: 60, cardLast4: '1234' },
    ])).toMatchObject({ valid: true, code: null, remaining: 0 })
  })
})

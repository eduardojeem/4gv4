import { describe, expect, it } from 'vitest'
import { validateRepairPaymentAmount } from './payment-limits'

describe('validateRepairPaymentAmount', () => {
  it('returns the remaining balance for a valid partial payment', () => {
    expect(validateRepairPaymentAmount({ totalDue: 500, paidAmount: 100, amount: 200 })).toBe(400)
  })

  it('rejects overpayments', () => {
    expect(() => validateRepairPaymentAmount({ totalDue: 500, paidAmount: 450, amount: 100 }))
      .toThrowError(/saldo pendiente/i)
  })

  it('requires credit financing to match the complete remaining balance', () => {
    expect(() => validateRepairPaymentAmount({ totalDue: 500, paidAmount: 100, amount: 200, isCredit: true }))
      .toThrowError(/saldo completo/i)
  })
})

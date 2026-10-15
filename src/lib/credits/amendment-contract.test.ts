import { describe, expect, it } from 'vitest'
import { creditAmendmentSchema, canAmendCredit } from './amendment-contract'

const common = { creditId: '00000000-0000-4000-8000-000000000001', expectedVersion: 'a'.repeat(32), reason: 'Corrección solicitada por el cliente' }
describe('credit amendments', () => {
  it('reserves amendments for organization owners and administrators', () => {
    for (const role of ['owner', 'admin']) expect(canAmendCredit(role)).toBe(true)
    for (const role of ['manager', 'seller', 'super_admin', undefined]) expect(canAmendCredit(role)).toBe(false)
  })
  it('requires a reason and a version, and never accepts direct paid balance edits', () => {
    const input = { ...common, action: 'adjust_balance', installmentId: common.creditId, amount: 200 }
    expect(creditAmendmentSchema.safeParse(input).success).toBe(true)
    expect(creditAmendmentSchema.safeParse({ ...input, reason: ' ' }).success).toBe(false)
    expect(creditAmendmentSchema.safeParse({ ...input, expectedVersion: '' }).success).toBe(false)
    expect(creditAmendmentSchema.safeParse({ ...input, amount_paid: 100 }).success).toBe(false)
  })
  it('rejects impossible calendar dates and repeated installments', () => {
    const input = { ...common, action: 'reschedule', installments: [{ id: common.creditId, dueDate: '2026-02-30' }] }
    expect(creditAmendmentSchema.safeParse(input).success).toBe(false)
    input.installments[0].dueDate = '2026-02-28'
    expect(creditAmendmentSchema.safeParse(input).success).toBe(true)
    expect(creditAmendmentSchema.safeParse({ ...input, installments: [...input.installments, ...input.installments] }).success).toBe(false)
  })
  it('bounds monetary terms and requires an explicit payment timestamp', () => {
    const input = { ...common, action: 'edit_terms', principalAmount: 1000, interestRate: 10, installmentCount: 3, frequency: 'monthly', firstDueDate: '2026-11-01' }
    expect(creditAmendmentSchema.safeParse(input).success).toBe(true)
    expect(creditAmendmentSchema.safeParse({ ...input, installmentCount: 0 }).success).toBe(false)
    expect(creditAmendmentSchema.safeParse({ ...input, interestRate: -1 }).success).toBe(false)
    expect(creditAmendmentSchema.safeParse({ ...common, action: 'correct_payment_date', paymentId: common.creditId, paidAt: '2026-11-01' }).success).toBe(false)
  })
})

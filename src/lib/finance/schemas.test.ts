import { describe, expect, it } from 'vitest'

import { expenseInputSchema, paymentInputSchema } from './schemas'

const branchId = 'c6ba2f4d-5ed0-41ca-94a4-a0926ea5c42d'
const categoryId = '08e261aa-8cad-4432-a1a6-3f4a9cdb885d'
const cashSessionId = 'db5e9d0e-97e7-49f9-9f46-35d71f918d20'

describe('expenseInputSchema', () => {
  it('accepts a positive dated expense with optional recurrence data', () => {
    const result = expenseInputSchema.safeParse({
      branchId,
      categoryId,
      amount: 250_000,
      accountingDate: '2026-08-11',
      dueDate: '2026-08-15',
      vendor: 'Proveedor SA',
      notes: 'Factura 123',
      recurrence: {
        frequency: 'monthly',
        startsOn: '2026-09-01',
      },
    })

    expect(result.success).toBe(true)
  })

  it('rejects a zero amount and malformed branch/category identifiers', () => {
    const result = expenseInputSchema.safeParse({
      branchId: 'not-a-uuid',
      categoryId: 'also-not-a-uuid',
      amount: 0,
      accountingDate: '2026-08-11',
    })

    expect(result.success).toBe(false)
  })
})

describe('paymentInputSchema', () => {
  it('requires a cash session only for cash payments', () => {
    const withoutSession = paymentInputSchema.safeParse({
      branchId,
      amount: 50_000,
      paymentMethod: 'cash',
      paymentDate: '2026-08-11',
    })
    const transfer = paymentInputSchema.safeParse({
      branchId,
      amount: 50_000,
      paymentMethod: 'bank_transfer',
      paymentDate: '2026-08-11',
    })
    const cash = paymentInputSchema.safeParse({
      branchId,
      amount: 50_000,
      paymentMethod: 'cash',
      paymentDate: '2026-08-11',
      cashSessionId,
    })

    expect(withoutSession.success).toBe(false)
    expect(transfer.success).toBe(true)
    expect(cash.success).toBe(true)
  })

  it('rejects non-positive payment amounts', () => {
    const result = paymentInputSchema.safeParse({
      branchId,
      amount: -1,
      paymentMethod: 'other',
      paymentDate: '2026-08-11',
    })

    expect(result.success).toBe(false)
  })

  it('rejects a cash session for a non-cash payment', () => {
    const result = paymentInputSchema.safeParse({
      branchId,
      amount: 50_000,
      paymentMethod: 'bank_transfer',
      paymentDate: '2026-08-11',
      cashSessionId,
    })

    expect(result.success).toBe(false)
  })
})

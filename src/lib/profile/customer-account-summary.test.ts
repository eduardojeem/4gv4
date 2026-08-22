import { describe, expect, it } from 'vitest'

import { calculateCustomerAccountSummary, getRepairBalance } from './customer-account-summary'

describe('calculateCustomerAccountSummary', () => {
  it('calculates the remaining repair balance from partial payments', () => {
    expect(getRepairBalance({
      final_cost: 300_000,
      paid_amount: 125_000,
      payment_status: 'parcial',
    })).toEqual({ cost: 300_000, paidAmount: 125_000, pendingAmount: 175_000, isPaid: false })
  })

  it('separates equipment status and repair payment balances', () => {
    const result = calculateCustomerAccountSummary({
      repairs: [
        { status: 'reparacion', estimated_cost: 200_000, paid_amount: 50_000, payment_status: 'parcial' },
        { status: 'listo', final_cost: 300_000, paid_amount: 300_000, payment_status: 'pagado' },
        { status: 'entregado', final_cost: 150_000, paid_amount: 0, payment_status: 'pendiente' },
        { status: 'cancelado', final_cost: 999_000, paid_amount: 0, payment_status: 'pendiente' },
      ],
      orders: [],
      credits: [],
      storeCreditMovements: [],
    })

    expect(result.equipment).toEqual({ total: 4, active: 1, ready: 1, delivered: 1 })
    expect(result.repairs).toEqual({ pendingCount: 2, paidCount: 1, pendingAmount: 300_000 })
  })

  it('uses only outstanding installment amounts and detects overdue credit', () => {
    const result = calculateCustomerAccountSummary({
      repairs: [],
      orders: [],
      credits: [{
        status: 'active',
        credit_installments: [
          { amount: 200_000, amount_paid: 50_000, status: 'pending', due_date: '2026-08-20' },
          { amount: 100_000, amount_paid: 20_000, status: 'late', due_date: '2026-07-20' },
          { amount: 90_000, amount_paid: 90_000, status: 'paid', due_date: '2026-06-20' },
        ],
      }],
      storeCreditMovements: [],
    })

    expect(result.financing).toEqual({ pendingAmount: 230_000, overdueAmount: 80_000, overdueCount: 1 })
  })

  it('excludes cancelled and refunded orders from the amount due', () => {
    const result = calculateCustomerAccountSummary({
      repairs: [],
      orders: [
        { status: 'CONFIRMED', payment_status: 'PENDING', total: 120_000 },
        { status: 'DELIVERED', payment_status: 'PAID', total: 80_000 },
        { status: 'CANCELLED', payment_status: 'PENDING', total: 500_000 },
        { status: 'DELIVERED', payment_status: 'REFUNDED', total: 70_000 },
      ],
      credits: [],
      storeCreditMovements: [],
    })

    expect(result.orders).toEqual({ pendingCount: 1, paidCount: 1, pendingAmount: 120_000 })
  })

  it('calculates the net position against available store credit', () => {
    const result = calculateCustomerAccountSummary({
      repairs: [{ status: 'listo', final_cost: 100_000, paid_amount: 0, payment_status: 'pendiente' }],
      orders: [],
      credits: [],
      storeCreditMovements: [{ amount: 180_000 }, { amount: -30_000 }],
    })

    expect(result.storeCredit).toBe(150_000)
    expect(result.totalDue).toBe(100_000)
    expect(result.netBalance).toBe(50_000)
  })
})

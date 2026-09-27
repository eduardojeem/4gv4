import { describe, expect, it } from 'vitest'

import { sumInstallmentsOutstanding, sumRepairsOutstanding } from './customer-outstanding'

describe('sumInstallmentsOutstanding', () => {
  it('counts only what is left on unpaid installments', () => {
    expect(sumInstallmentsOutstanding([
      { status: 'paid', amount: 100_000, amount_paid: 100_000 },
      { status: 'pending', amount: 200_000, amount_paid: 50_000 },
      { status: 'late', amount: 300_000, amount_paid: null },
    ])).toBe(450_000)
  })

  it('ignores installments that are not pending or late', () => {
    expect(sumInstallmentsOutstanding([
      { status: 'cancelled', amount: 500_000 },
      { status: 'paid', amount: 500_000 },
    ])).toBe(0)
  })

  it('never lets an overpaid installment turn into negative debt', () => {
    expect(sumInstallmentsOutstanding([
      { status: 'pending', amount: 100_000, amount_paid: 150_000 },
    ])).toBe(0)
  })
})

describe('sumRepairsOutstanding', () => {
  it('counts the balance left on unpaid repairs', () => {
    expect(sumRepairsOutstanding([
      { payment_status: 'pendiente', final_cost: 500_000, paid_amount: 200_000 },
      { payment_status: 'parcial', final_cost: 300_000, paid_amount: 0 },
    ])).toBe(600_000)
  })

  it('ignores repairs already settled', () => {
    expect(sumRepairsOutstanding([
      { payment_status: 'pagado', final_cost: 500_000, paid_amount: 500_000 },
      { payment_status: 'paid', final_cost: 400_000, paid_amount: 0 },
    ])).toBe(0)
  })

  // Sin costo cargado no hay deuda que reclamar todavía.
  it('ignores repairs with no cost yet', () => {
    expect(sumRepairsOutstanding([
      { payment_status: 'pendiente', final_cost: null, estimated_cost: null },
    ])).toBe(0)
  })

  it('falls back to the estimate when there is no final cost', () => {
    expect(sumRepairsOutstanding([
      { payment_status: 'pendiente', final_cost: null, estimated_cost: 250_000, paid_amount: 50_000 },
    ])).toBe(200_000)
  })

  it('never reports negative debt when the customer overpaid', () => {
    expect(sumRepairsOutstanding([
      { payment_status: 'pendiente', final_cost: 100_000, paid_amount: 180_000 },
    ])).toBe(0)
  })
})

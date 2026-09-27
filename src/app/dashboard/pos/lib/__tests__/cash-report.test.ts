import { describe, expect, it } from 'vitest'
import { normalizeCashPaymentMethod, summarizeCashMovements } from '../cash-report'

describe('cash report contracts', () => {
  it('normalizes canonical and historical payment method names', () => {
    expect(normalizeCashPaymentMethod('efectivo')).toBe('cash')
    expect(normalizeCashPaymentMethod('tarjeta')).toBe('card')
    expect(normalizeCashPaymentMethod('transferencia')).toBe('transfer')
    expect(normalizeCashPaymentMethod('qr')).toBe('transfer')
    expect(normalizeCashPaymentMethod('mixto')).toBe('mixed')
  })

  it('produces totals and payment method rows from canonical and legacy movements', () => {
    const report = summarizeCashMovements([
      { type: 'sale', amount: 100_000, payment_method: 'efectivo' },
      { type: 'venta', amount: 50_000, payment_method: 'card' },
      { type: 'sale', amount: 25_000, payment_method: 'qr' },
      { type: 'ingreso', amount: 10_000 },
      { type: 'egreso', amount: 5_000 },
    ])

    expect(report.totalSales).toBe(175_000)
    expect(report.incomes).toBe(185_000)
    expect(report.expenses).toBe(5_000)
    expect(report.cashSales).toBe(100_000)
    expect(report.cardSales).toBe(50_000)
    expect(report.transferSales).toBe(25_000)
    expect(report.paymentMethods).toEqual([
      { method: 'cash', amount: 100_000, count: 1, percentage: 57.14285714285714 },
      { method: 'card', amount: 50_000, count: 1, percentage: 28.57142857142857 },
      { method: 'transfer', amount: 25_000, count: 1, percentage: 14.285714285714285 },
    ])
  })
})

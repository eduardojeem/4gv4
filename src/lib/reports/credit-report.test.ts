import { describe, expect, it } from 'vitest'

import { buildCreditReport } from './credit-report'

describe('buildCreditReport', () => {
  it('separates period activity from the current portfolio', () => {
    const report = buildCreditReport({
      credits: [
        { id: 'new', customerId: 'customer-a', principal: 100_000, interestRate: 10, createdAt: '2026-08-20T12:00:00Z' },
        { id: 'old', customerId: 'customer-b', principal: 200_000, interestRate: 20, createdAt: '2026-06-10T12:00:00Z' },
      ],
      installments: [
        { creditId: 'new', amount: 110_000, amountPaid: 10_000, status: 'pending', dueDate: '2026-09-15' },
        { creditId: 'old', amount: 120_000, amountPaid: 20_000, status: 'pending', dueDate: '2026-08-10' },
        { creditId: 'old', amount: 120_000, amountPaid: 120_000, status: 'paid', dueDate: '2026-07-10' },
      ],
      payments: [
        { creditId: 'new', amount: 10_000, createdAt: '2026-08-21T12:00:00Z' },
        { creditId: 'old', amount: 20_000, createdAt: '2026-08-22T12:00:00Z' },
        { creditId: 'old', amount: 100_000, createdAt: '2026-07-10T12:00:00Z' },
      ],
      from: new Date('2026-08-01T00:00:00Z'),
      to: new Date('2026-08-31T23:59:59Z'),
      today: '2026-09-01',
    })

    expect(report.period).toEqual({
      grantedCount: 1,
      principalGranted: 100_000,
      financedTotal: 110_000,
      scheduledInterest: 10_000,
      paymentsReceived: 30_000,
      averageInterestRate: 10,
    })
    expect(report.portfolio).toMatchObject({
      activeCredits: 2,
      outstandingAmount: 200_000,
      overdueAmount: 100_000,
      overdueInstallments: 1,
      overdueCustomers: 1,
      dueSoonAmount: 100_000,
    })
    expect(report.paymentTrend).toEqual([
      { date: '2026-08-21', amount: 10_000 },
      { date: '2026-08-22', amount: 20_000 },
    ])
  })

  it('treats paid legacy installments as settled and never reports negative balances', () => {
    const report = buildCreditReport({
      credits: [{ id: 'credit', customerId: 'customer', principal: 50_000, interestRate: 0, createdAt: '2026-08-01T00:00:00Z' }],
      installments: [
        { creditId: 'credit', amount: 50_000, amountPaid: null, status: 'paid', dueDate: '2026-08-10' },
        { creditId: 'credit', amount: 10_000, amountPaid: 12_000, status: 'pending', dueDate: '2026-08-20' },
      ],
      payments: [],
      from: new Date('2026-08-01T00:00:00Z'),
      to: new Date('2026-08-31T23:59:59Z'),
      today: '2026-09-01',
    })

    expect(report.portfolio.outstandingAmount).toBe(0)
    expect(report.portfolio.overdueAmount).toBe(0)
    expect(report.portfolio.activeCredits).toBe(0)
    expect(report.statusDistribution).toEqual([{ status: 'completed', count: 1 }])
  })
})

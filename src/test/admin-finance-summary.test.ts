import { describe, expect, it } from 'vitest'

import { buildFinanceSummaryFromRecords } from '@/lib/finance/server'

const period = {
  startDate: '2026-08-01',
  endDate: '2026-08-31',
  branchId: 'branch-a',
}

describe('canonical finance summary aggregation', () => {
  it('keeps accrued profit separate from collected and paid cash', () => {
    const result = buildFinanceSummaryFromRecords(
      {
        sales: [
          {
            id: 'sale-completed',
            branchId: 'branch-a',
            createdAt: '2026-08-04T10:00:00Z',
            status: 'completed',
            totalAmount: 1_000,
            paidAmount: 800,
          },
          {
            id: 'sale-pending',
            branchId: 'branch-a',
            createdAt: '2026-08-05T10:00:00Z',
            status: 'pending',
            totalAmount: 9_999,
            paidAmount: 9_999,
          },
        ],
        saleItems: [
          { saleId: 'sale-completed', quantity: 2, unitCost: 200 },
        ],
        repairs: [
          {
            id: 'repair-kept',
            branchId: 'branch-a',
            createdAt: '2026-08-06T10:00:00Z',
            status: 'entregado',
            revenueAmount: 300,
            paidAmount: 100,
          },
          {
            id: 'repair-cancelled',
            branchId: 'branch-a',
            createdAt: '2026-08-07T10:00:00Z',
            status: 'cancelado',
            revenueAmount: 9_999,
            paidAmount: 9_999,
          },
        ],
        repairParts: [{ repairId: 'repair-kept', quantity: 1, unitCost: 50 }],
        obligations: [
          {
            id: 'rent',
            branchId: 'branch-a',
            accountingDate: '2026-08-01',
            dueDate: '2026-08-15',
            status: 'pending',
            amount: 200,
          },
        ],
        payrollEntries: [
          {
            id: 'approved-payroll',
            branchId: 'branch-a',
            approvedAt: '2026-08-15',
            status: 'approved',
            netAmount: 150,
          },
        ],
        financePayments: [
          { branchId: 'branch-a', paymentDate: '2026-08-08', direction: 'payment', amount: 40 },
        ],
        payrollPayments: [
          { branchId: 'branch-a', paymentDate: '2026-08-20', direction: 'payment', amount: 50 },
        ],
      },
      period,
      '2026-08-12',
    )

    expect(result.accrued).toEqual({
      revenue: 1_300,
      directCosts: 450,
      grossProfit: 850,
      operatingExpenses: 200,
      payrollCost: 150,
      netProfit: 500,
    })
    expect(result.cash).toEqual({ collected: 900, paid: 90, netCashFlow: 810 })
    expect(result.complete).toBe(true)
    expect(result.upcomingDue).toEqual([{ id: 'rent', dueDate: '2026-08-15', amount: 200 }])
  })

  it('keeps branch scope, prior period comparison, and missing purchase-cost coverage explicit', () => {
    const result = buildFinanceSummaryFromRecords(
      {
        sales: [
          {
            id: 'missing-cost',
            branchId: 'branch-a',
            createdAt: '2026-08-03T10:00:00Z',
            status: 'completed',
            totalAmount: 100,
            paidAmount: 100,
          },
          {
            id: 'other-branch',
            branchId: 'branch-b',
            createdAt: '2026-08-03T10:00:00Z',
            status: 'completed',
            totalAmount: 500,
            paidAmount: 500,
          },
          {
            id: 'previous',
            branchId: 'branch-a',
            createdAt: '2026-07-03T10:00:00Z',
            status: 'completed',
            totalAmount: 50,
            paidAmount: 50,
          },
        ],
        saleItems: [
          { saleId: 'missing-cost', quantity: 1, unitCost: null },
          { saleId: 'other-branch', quantity: 1, unitCost: 10 },
          { saleId: 'previous', quantity: 1, unitCost: 20 },
        ],
        repairs: [],
        repairParts: [],
        obligations: [
          {
            id: 'overdue-other-branch',
            branchId: 'branch-b',
            accountingDate: '2026-08-01',
            dueDate: '2026-08-02',
            status: 'pending',
            amount: 600,
          },
        ],
        payrollEntries: [],
        financePayments: [
          { branchId: 'branch-a', paymentDate: '2026-08-02', direction: 'reversal', amount: 5 },
        ],
        payrollPayments: [],
      },
      period,
      '2026-08-12',
    )

    expect(result.complete).toBe(false)
    expect(result.accrued.grossProfit).toBeNull()
    expect(result.coverageWarnings).toEqual([
      expect.objectContaining({ code: 'MISSING_DIRECT_COST', sourceId: 'missing-cost' }),
    ])
    expect(result.cash).toEqual({ collected: 100, paid: -5, netCashFlow: 105 })
    expect(result.comparison.accrued.revenue).toBe(50)
    expect(result.overdue).toEqual([])
  })

  it('does not treat a repair part without its recorded unit cost as a zero-cost repair', () => {
    const result = buildFinanceSummaryFromRecords(
      {
        sales: [],
        saleItems: [],
        repairs: [
          {
            id: 'repair-with-missing-part-cost',
            branchId: 'branch-a',
            createdAt: '2026-08-08T10:00:00Z',
            status: 'entregado',
            revenueAmount: 300,
            paidAmount: 0,
          },
        ],
        repairParts: [
          { repairId: 'repair-with-missing-part-cost', quantity: 1, unitCost: null },
        ],
        obligations: [],
        payrollEntries: [],
        financePayments: [],
        payrollPayments: [],
      },
      period,
    )

    expect(result.complete).toBe(false)
    expect(result.coverageWarnings).toEqual([
      expect.objectContaining({
        code: 'MISSING_DIRECT_COST',
        sourceId: 'repair-with-missing-part-cost',
      }),
    ])
  })
})

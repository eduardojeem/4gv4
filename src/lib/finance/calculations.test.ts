import { describe, expect, it } from 'vitest'

import {
  calculateFinancialSummary,
  resolveCommissionRule,
} from './calculations'

describe('calculateFinancialSummary', () => {
  it('separates accrued net profit from paid cash flow', () => {
    const result = calculateFinancialSummary({
      revenue: [{ amount: 1_000_000, cashAmount: 800_000, hasCost: true }],
      directCosts: [{ amount: 400_000, paidAmount: 400_000 }],
      expenses: [{ amount: 200_000, paidAmount: 0 }],
      payroll: [{ amount: 150_000, paidAmount: 50_000 }],
    })

    expect(result.accrued.netProfit).toBe(250_000)
    expect(result.cash.netCashFlow).toBe(350_000)
    expect(result.complete).toBe(true)
  })

  it('marks the result incomplete when a sold item has no cost', () => {
    const result = calculateFinancialSummary({
      revenue: [{ amount: 100_000, cashAmount: 100_000, hasCost: false }],
      directCosts: [],
      expenses: [],
      payroll: [],
    })

    expect(result.complete).toBe(false)
    expect(result.accrued.grossProfit).toBeNull()
    expect(result.accrued.netProfit).toBeNull()
    expect(result.coverageWarnings[0]).toMatchObject({
      code: 'MISSING_DIRECT_COST',
    })
  })

  it.each([
    {
      label: 'a non-finite collected amount',
      input: {
        revenue: [{ amount: 100, cashAmount: Infinity, hasCost: true }],
        directCosts: [],
        expenses: [],
        payroll: [],
      },
    },
    {
      label: 'a paid amount with more than two decimals',
      input: {
        revenue: [],
        directCosts: [{ amount: 100, paidAmount: 0.001 }],
        expenses: [],
        payroll: [],
      },
    },
    {
      label: 'a collection larger than its revenue',
      input: {
        revenue: [{ amount: 100, cashAmount: 100.01, hasCost: true }],
        directCosts: [],
        expenses: [],
        payroll: [],
      },
    },
  ])('rejects $label at the calculation boundary', ({ input }) => {
    expect(() => calculateFinancialSummary(input)).toThrow(RangeError)
  })
})

describe('resolveCommissionRule', () => {
  it('prefers an active employee rule over an active role rule', () => {
    const result = resolveCommissionRule(
      [
        {
          id: 'role-rule',
          scopeType: 'role',
          role: 'seller',
          source: 'sale',
          calculationType: 'percentage',
          value: 5,
          effectiveFrom: '2026-01-01',
        },
        {
          id: 'employee-rule',
          scopeType: 'employee',
          employeeId: 'employee-1',
          source: 'sale',
          calculationType: 'percentage',
          value: 10,
          effectiveFrom: '2026-01-01',
        },
      ],
      {
        employeeId: 'employee-1',
        role: 'seller',
        source: 'sale',
        occurredOn: '2026-08-11',
      },
    )

    expect(result?.id).toBe('employee-rule')
  })

  it('excludes rules outside their branch or effective period', () => {
    const result = resolveCommissionRule(
      [
        {
          id: 'expired',
          scopeType: 'role',
          role: 'seller',
          source: 'sale',
          calculationType: 'percentage',
          value: 5,
          effectiveFrom: '2025-01-01',
          effectiveTo: '2025-12-31',
        },
        {
          id: 'other-branch',
          scopeType: 'role',
          role: 'seller',
          branchId: 'branch-2',
          source: 'sale',
          calculationType: 'percentage',
          value: 8,
          effectiveFrom: '2026-01-01',
        },
      ],
      {
        employeeId: 'employee-1',
        role: 'seller',
        branchId: 'branch-1',
        source: 'sale',
        occurredOn: '2026-08-11',
      },
    )

    expect(result).toBeNull()
  })
})

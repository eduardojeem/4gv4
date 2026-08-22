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

  it.each([0.29, 999_999_999_999.99])(
    'accepts the valid numeric(14,2) amount %d',
    (amount) => {
      const result = calculateFinancialSummary({
        revenue: [{ amount, cashAmount: amount, hasCost: true }],
        directCosts: [],
        expenses: [],
        payroll: [],
      })

      expect(result.accrued.revenue).toBe(amount)
      expect(result.cash.collected).toBe(amount)
    },
  )

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
      label: 'an amount with excess precision below an epsilon',
      input: {
        revenue: [],
        directCosts: [{ amount: 1.0000000001, paidAmount: 0 }],
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

  // Una devolucion cerrada revierte la venta que ya se conto como ingreso. Sin
  // esto el resumen mostraba la utilidad inflada por cada devolucion del periodo.
  it('reverses revenue and recovers cost when the returned goods are sellable again', () => {
    const result = calculateFinancialSummary({
      revenue: [{ amount: 1_000_000, cashAmount: 1_000_000, hasCost: true }],
      directCosts: [{ amount: 600_000, paidAmount: 600_000 }],
      expenses: [],
      payroll: [],
      refunds: [{ amount: 100_000, recoveredCost: 60_000, cashAmount: 100_000 }],
    })

    expect(result.accrued.revenue).toBe(900_000)
    expect(result.accrued.directCosts).toBe(540_000)
    // Se pierde el margen de esa venta, no la venta entera.
    expect(result.accrued.grossProfit).toBe(360_000)
  })

  it('sinks the whole cost when the returned goods do not come back sellable', () => {
    const result = calculateFinancialSummary({
      revenue: [{ amount: 1_000_000, cashAmount: 1_000_000, hasCost: true }],
      directCosts: [{ amount: 600_000, paidAmount: 600_000 }],
      expenses: [],
      payroll: [],
      refunds: [{ amount: 100_000, recoveredCost: 0, cashAmount: 100_000 }],
    })

    expect(result.accrued.revenue).toBe(900_000)
    expect(result.accrued.directCosts).toBe(600_000)
    // Cuarentena: se pierde el ingreso completo, no solo el margen.
    expect(result.accrued.grossProfit).toBe(300_000)
  })

  it('counts a cash refund as money out of the period', () => {
    const result = calculateFinancialSummary({
      revenue: [{ amount: 500_000, cashAmount: 500_000, hasCost: true }],
      directCosts: [],
      expenses: [],
      payroll: [],
      refunds: [{ amount: 80_000, recoveredCost: 0, cashAmount: 80_000 }],
    })

    expect(result.cash.paid).toBe(80_000)
    expect(result.cash.netCashFlow).toBe(420_000)
  })

  // Un saldo a favor afecta el resultado pero no mueve la caja del periodo.
  it('keeps store-credit refunds out of the cash flow', () => {
    const result = calculateFinancialSummary({
      revenue: [{ amount: 500_000, cashAmount: 500_000, hasCost: true }],
      directCosts: [],
      expenses: [],
      payroll: [],
      refunds: [{ amount: 80_000, recoveredCost: 0, cashAmount: 0 }],
    })

    expect(result.accrued.revenue).toBe(420_000)
    expect(result.cash.paid).toBe(0)
    expect(result.cash.netCashFlow).toBe(500_000)
  })

  it('behaves exactly as before when no refunds are declared', () => {
    const base = {
      revenue: [{ amount: 1_000_000, cashAmount: 800_000, hasCost: true }],
      directCosts: [{ amount: 400_000, paidAmount: 400_000 }],
      expenses: [],
      payroll: [],
    }

    expect(calculateFinancialSummary(base)).toEqual(
      calculateFinancialSummary({ ...base, refunds: [] }),
    )
  })

  it('rejects recovering more cost than the amount refunded', () => {
    expect(() => calculateFinancialSummary({
      revenue: [],
      directCosts: [],
      expenses: [],
      payroll: [],
      refunds: [{ amount: 50_000, recoveredCost: 90_000, cashAmount: 0 }],
    })).toThrow(RangeError)
  })

  it('rejects paying out more cash than the amount refunded', () => {
    expect(() => calculateFinancialSummary({
      revenue: [],
      directCosts: [],
      expenses: [],
      payroll: [],
      refunds: [{ amount: 50_000, recoveredCost: 0, cashAmount: 90_000 }],
    })).toThrow(RangeError)
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

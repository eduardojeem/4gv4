import { describe, expect, it } from 'vitest'

import {
  buildFinanceSummaryFromRecords,
  buildUnpaidObligationUpdate,
  toFinanceApiError,
  type FinanceSummaryRecords,
} from './server'

describe('buildUnpaidObligationUpdate', () => {
  const current = {
    category_id: 'category-id',
    concept: 'Alquiler',
    amount: 100,
    vendor: 'Proveedor',
    accounting_date: '2026-08-01',
    due_date: '2026-08-10',
    notes: 'Original',
  }

  it('derives overdue and pending from the effective due date', () => {
    expect(
      buildUnpaidObligationUpdate(current, { branchId: 'branch-id' }, '2026-08-11'),
    ).toMatchObject({ status: 'overdue' })

    expect(
      buildUnpaidObligationUpdate(
        current,
        { branchId: 'branch-id', dueDate: '2026-08-12' },
        '2026-08-11',
      ),
    ).toMatchObject({ due_date: '2026-08-12', status: 'pending' })
  })

  it('clears nullable fields only when explicit null is supplied', () => {
    expect(
      buildUnpaidObligationUpdate(
        current,
        { branchId: 'branch-id', dueDate: null, vendor: null, notes: null },
        '2026-08-11',
      ),
    ).toMatchObject({
      due_date: null,
      vendor: null,
      notes: null,
      status: 'pending',
    })

    const omitted = buildUnpaidObligationUpdate(
      current,
      { branchId: 'branch-id' },
      '2026-08-11',
    )
    expect(omitted).not.toHaveProperty('due_date')
    expect(omitted).not.toHaveProperty('vendor')
    expect(omitted).not.toHaveProperty('notes')
  })

  it('does not reuse the old due date when it is cleared with an accounting-date change', () => {
    expect(
      buildUnpaidObligationUpdate(
        current,
        {
          branchId: 'branch-id',
          accountingDate: '2026-08-20',
          dueDate: null,
        },
        '2026-08-11',
      ),
    ).toMatchObject({
      accounting_date: '2026-08-20',
      due_date: null,
      status: 'pending',
    })
  })
})

describe('toFinanceApiError', () => {
  it('maps recurring idempotency payload reuse to a sanitized conflict', () => {
    const error = toFinanceApiError({
      message:
        'FINANCE_RECURRING_IDEMPOTENCY_KEY_REUSED internal payload details',
    })

    expect(error.status).toBe(409)
    expect(error.code).toBe('FINANCE_CONFLICT')
    expect(error.message).toBe(
      'El pago entra en conflicto con el estado actual de la obligacion.',
    )
    expect(error.message).not.toContain('internal payload details')
  })
})

describe('devoluciones de posventa en el resumen', () => {
  const filters = { startDate: '2026-08-01', endDate: '2026-08-31', branchId: null }

  const baseRecords: FinanceSummaryRecords = {
    sales: [{
      id: 'sale-1', code: 'VTA-1', branchId: 'branch-1', createdAt: '2026-08-05T10:00:00.000Z',
      status: 'completed', totalAmount: 1_000_000, paidAmount: 0, employeeId: null,
    }],
    saleItems: [{
      id: 'item-1', saleId: 'sale-1', productId: 'product-1', productName: 'Cargador',
      quantity: 1, unitCost: 600_000, revenueAmount: 1_000_000,
    }],
    salePayments: [{
      saleId: 'sale-1', branchId: 'branch-1', paymentDate: '2026-08-05',
      amount: 1_000_000, paymentMethod: 'cash', status: 'completed',
    }],
    salePaymentTimingAvailable: true,
    creditPayments: [],
    creditPaymentTimingAvailable: true,
    repairs: [],
    repairParts: [],
    obligations: [],
    payrollEntries: [],
    financePayments: [],
    payrollPayments: [],
  } as unknown as FinanceSummaryRecords

  const withRefund = (refund: Partial<{ amount: number; recoveredCost: number; cashAmount: number }>) =>
    buildFinanceSummaryFromRecords({
      ...baseRecords,
      refunds: [{
        id: 'case-1',
        branchId: 'branch-1',
        resolvedAt: '2026-08-20T12:00:00.000Z',
        amount: 200_000,
        recoveredCost: 0,
        cashAmount: 0,
        ...refund,
      }],
    }, filters)

  it('sin devoluciones el resumen no cambia', () => {
    const summary = buildFinanceSummaryFromRecords(baseRecords, filters)
    expect(summary.accrued.revenue).toBe(1_000_000)
    expect(summary.accrued.directCosts).toBe(600_000)
  })

  // El bug: la venta seguia contando entera y el reintegro no aparecia, asi que
  // la utilidad quedaba inflada por cada devolucion del periodo.
  it('descuenta del ingreso la devolucion cerrada en el periodo', () => {
    const summary = withRefund({ amount: 200_000, cashAmount: 200_000 })
    expect(summary.accrued.revenue).toBe(800_000)
  })

  it('recupera el costo solo si la mercaderia volvio vendible', () => {
    expect(withRefund({ amount: 200_000, recoveredCost: 120_000 }).accrued.directCosts).toBe(480_000)
    expect(withRefund({ amount: 200_000, recoveredCost: 0 }).accrued.directCosts).toBe(600_000)
  })

  it('cuenta el reintegro por caja como salida de efectivo', () => {
    const summary = withRefund({ amount: 200_000, cashAmount: 200_000 })
    expect(summary.cash.paid).toBe(200_000)
    expect(summary.cash.netCashFlow).toBe(800_000)
  })

  it('deja el saldo a favor fuera del flujo de caja', () => {
    const summary = withRefund({ amount: 200_000, cashAmount: 0 })
    expect(summary.accrued.revenue).toBe(800_000)
    expect(summary.cash.paid).toBe(0)
  })

  it('ignora una devolucion cerrada fuera del periodo', () => {
    const summary = buildFinanceSummaryFromRecords({
      ...baseRecords,
      refunds: [{
        id: 'case-old', branchId: 'branch-1', resolvedAt: '2026-07-10T12:00:00.000Z',
        amount: 200_000, recoveredCost: 0, cashAmount: 200_000,
      }],
    }, filters)
    expect(summary.accrued.revenue).toBe(1_000_000)
  })

  it('respeta el filtro por sucursal', () => {
    const summary = buildFinanceSummaryFromRecords({
      ...baseRecords,
      refunds: [{
        id: 'case-other', branchId: 'branch-2', resolvedAt: '2026-08-20T12:00:00.000Z',
        amount: 200_000, recoveredCost: 0, cashAmount: 200_000,
      }],
    }, { ...filters, branchId: 'branch-1' })
    expect(summary.accrued.revenue).toBe(1_000_000)
  })
})

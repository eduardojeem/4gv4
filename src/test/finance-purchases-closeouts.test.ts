import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: vi.fn() }))

import { buildFinanceSummaryFromRecords, isInventoryPurchase } from '@/lib/finance/server'

const period = { startDate: '2026-10-01', endDate: '2026-10-31' }
const base = { sales: [], saleItems: [], repairs: [], repairParts: [], obligations: [], payrollEntries: [], financePayments: [], payrollPayments: [] }
type Records = Parameters<typeof buildFinanceSummaryFromRecords>[0]
const summary = (records: Partial<Records>) => buildFinanceSummaryFromRecords({ ...base, ...records } as Records, period, '2026-11-01')
const obligation = (id: string, amount: number, extra: Record<string, unknown> = {}) =>
  ({ id, branchId: null, accountingDate: '2026-10-05', dueDate: null, status: 'paid', amount, paidAmount: amount, ...extra })

describe('compras de mercadería y repuestos', () => {
  it('se reconocen por la categoría o por la marca de «No lo tengo, lo compro»', () => {
    expect(isInventoryPurchase({ categoryType: 'direct_cost', notes: null })).toBe(true)
    expect(isInventoryPurchase({ categoryType: 'operating_expense', notes: 'repair-part-purchase:abc' })).toBe(true)
    expect(isInventoryPurchase({ categoryType: 'operating_expense', notes: null })).toBe(false)
  })

  it('no restan como gasto (el costo ya entra al entregar la reparación), pero sí salen de caja', () => {
    const result = summary({
      repairs: [{ id: 'r1', branchId: null, createdAt: '2026-10-01T12:00:00Z', deliveredAt: '2026-10-10T12:00:00Z', status: 'entregado', revenueAmount: 350_000, paidAmount: 350_000 }],
      repairParts: [{ id: 'p1', repairId: 'r1', quantity: 1, unitCost: 150_000, status: 'installed' }],
      obligations: [
        obligation('compra', 150_000, { notes: 'repair-part-purchase:k1' }),
        obligation('alquiler', 100_000, { categoryType: 'operating_expense' }),
      ],
      financePayments: [{ branchId: null, paymentDate: '2026-10-05', direction: 'payment', amount: 150_000 }],
    })
    expect(result.accrued.operatingExpenses).toBe(100_000)
    expect(result.accrued.directCosts).toBe(150_000)
    expect(result.accrued.netProfit).toBe(100_000)
    expect(result.cash.paid).toBe(150_000)
  })

  it('un gasto cargado con una categoría de sueldos cuenta como sueldo', () => {
    const result = summary({ obligations: [obligation('bono', 80_000, { categoryType: 'payroll' })] })
    expect(result.accrued.payrollCost).toBe(80_000)
    expect(result.accrued.operatingExpenses).toBe(0)
  })
})

describe('reparaciones cerradas sin reparar', () => {
  const repair = { id: 'r2', ticketNumber: 'R-2', branchId: null, createdAt: '2026-10-01T12:00:00Z', deliveredAt: '2026-10-12T12:00:00Z', status: 'entregado', revenueAmount: 50_000, paidAmount: 50_000 }

  it('el repuesto que volvió al stock no es costo', () => {
    const result = summary({
      repairs: [repair],
      repairParts: [{ id: 'p2', repairId: 'r2', quantity: 1, unitCost: 200_000, status: 'installed' }],
      repairCloseouts: [{ repairId: 'r2', branchId: null, createdAt: '2026-10-12T12:00:00Z', restockedPartIds: ['p2'], refundAmount: 0, refundMethod: null }],
    })
    expect(result.accrued.directCosts).toBe(0)
    expect(result.accrued.grossProfit).toBe(50_000)
  })

  it('la devolución al cliente sale de caja', () => {
    const result = summary({
      repairs: [repair],
      repairCloseouts: [{ repairId: 'r2', branchId: null, createdAt: '2026-10-12T12:00:00Z', restockedPartIds: [], refundAmount: 150_000, refundMethod: 'cash' }],
    })
    expect(result.cash.paid).toBe(150_000)
  })

  it('una garantía entregada sin cobrar no avisa «sin precio»', () => {
    const result = summary({ repairs: [{ ...repair, revenueAmount: 0, paidAmount: 0, isWarranty: true }] })
    expect(result.coverageWarnings.map((warning) => warning.code)).not.toContain('MISSING_REPAIR_PRICE')
  })
})

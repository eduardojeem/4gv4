import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: vi.fn() }))

import { buildFinanceSummaryFromRecords, buildProfitabilityRows } from '@/lib/finance/server'

const period = { startDate: '2026-08-01', endDate: '2026-08-31' }
const base = {
  sales: [],
  saleItems: [],
  repairs: [],
  repairParts: [],
  obligations: [],
  payrollEntries: [],
  financePayments: [],
  payrollPayments: [],
}
type Records = Parameters<typeof buildFinanceSummaryFromRecords>[0]
const summary = (records: Partial<Records>) =>
  buildFinanceSummaryFromRecords({ ...base, ...records } as Records, period, '2026-08-31')

/** Reparación de 500 entregada y cobrada en el POS con la venta `sale-pos`. */
const repairPaidAtPos = {
  repairs: [{
    id: 'repair-1',
    ticketNumber: 'R-1',
    branchId: null,
    createdAt: '2026-08-02T10:00:00Z',
    deliveredAt: '2026-08-10T10:00:00Z',
    status: 'entregado',
    revenueAmount: 500,
    paidAmount: 500,
    laborAmount: 200,
  }],
  repairPayments: [{
    repairId: 'repair-1',
    branchId: null,
    paymentDate: '2026-08-10T10:00:00Z',
    paymentMethod: 'cash',
    amount: 500,
    saleId: 'sale-pos',
  }],
}

describe('reparaciones cobradas en el POS', () => {
  it('una venta que solo saldó la reparación no se cuenta otra vez, ni en ingresos ni en caja', () => {
    const result = summary({
      ...repairPaidAtPos,
      sales: [{ id: 'sale-pos', branchId: null, createdAt: '2026-08-10T10:00:00Z', status: 'completed', totalAmount: 500, paidAmount: 500 }],
      salePayments: [{ saleId: 'sale-pos', branchId: null, paymentDate: '2026-08-10T10:00:00Z', paymentMethod: 'cash', status: 'completed', amount: 500 }],
    })
    expect(result.accrued.revenue).toBe(500)
    expect(result.cash.collected).toBe(500)
    // Sin ítems ya no deja la ganancia «Pendiente» por falta de costo.
    expect(result.coverageWarnings.filter((warning) => warning.code === 'MISSING_DIRECT_COST')).toEqual([])
    expect(result.accrued.grossProfit).toBe(500)
  })

  it('en una venta mixta solo se resta la parte de la reparación', () => {
    const result = summary({
      ...repairPaidAtPos,
      sales: [{ id: 'sale-pos', branchId: null, createdAt: '2026-08-10T10:00:00Z', status: 'completed', totalAmount: 800, paidAmount: 800 }],
      saleItems: [{ saleId: 'sale-pos', productId: 'case', quantity: 1, unitCost: 100, revenueAmount: 300 }],
    })
    expect(result.accrued.revenue).toBe(800)
    expect(result.accrued.revenueBreakdown).toMatchObject({ merchandise: 300, repairs: { total: 500 } })
    expect(result.accrued.directCosts).toBe(100)
  })

  it('un cobro de reparación hecho en el taller sí suma en caja', () => {
    const result = summary({
      repairs: repairPaidAtPos.repairs,
      repairPayments: [{ ...repairPaidAtPos.repairPayments[0], saleId: null }],
    })
    expect(result.cash.collected).toBe(500)
  })
})

describe('apertura de los ingresos', () => {
  it('separa mercadería, servicios, reparaciones (mano de obra y repuestos) y pedidos', () => {
    const result = summary({
      ...repairPaidAtPos,
      repairPayments: [],
      sales: [{ id: 'sale-1', branchId: null, createdAt: '2026-08-05T10:00:00Z', status: 'completed', totalAmount: 1_000, paidAmount: 1_000 }],
      saleItems: [
        { saleId: 'sale-1', productId: 'cable', quantity: 1, unitCost: 300, revenueAmount: 600 },
        { saleId: 'sale-1', productId: 'corte', quantity: 1, unitCost: null, revenueAmount: 400, isService: true },
      ],
      orders: [{ id: 'order-1', code: 'P-1', branchId: null, createdAt: '2026-08-06T10:00:00Z', status: 'PAID', paymentStatus: 'PAID', totalAmount: 250, paidAmount: 250 }],
      orderItems: [{ orderId: 'order-1', productId: 'cable', quantity: 1, unitCost: 100 }],
    })
    expect(result.accrued.revenueBreakdown).toEqual({
      merchandise: 600,
      services: 400,
      repairs: { total: 500, labor: 200, parts: 300, count: 1 },
      orders: 250,
      interest: 0,
      refunds: 0,
      grossRevenue: 1_750,
    })
    expect(result.accrued.revenue).toBe(1_750)
  })

  it('un servicio sin costo de compra cuenta con costo cero y no deja la ganancia pendiente', () => {
    const result = summary({
      sales: [{ id: 'sale-1', branchId: null, createdAt: '2026-08-05T10:00:00Z', status: 'completed', totalAmount: 400, paidAmount: 400 }],
      saleItems: [{ saleId: 'sale-1', productId: 'corte', quantity: 1, unitCost: null, revenueAmount: 400, isService: true }],
    })
    expect(result.accrued.grossProfit).toBe(400)
    expect(result.coverageWarnings).toEqual([])
  })

  it('un producto sin costo sigue avisando: solo los servicios cuentan como costo cero', () => {
    const result = summary({
      sales: [{ id: 'sale-1', branchId: null, createdAt: '2026-08-05T10:00:00Z', status: 'completed', totalAmount: 400, paidAmount: 400 }],
      saleItems: [{ saleId: 'sale-1', productId: 'cable', quantity: 1, unitCost: null, revenueAmount: 400 }],
    })
    expect(result.accrued.grossProfit).toBeNull()
    expect(result.coverageWarnings.map((warning) => warning.code)).toContain('MISSING_DIRECT_COST')
  })

  it('la mano de obra no puede superar el precio de la reparación', () => {
    const result = summary({
      repairs: [{ ...repairPaidAtPos.repairs[0], revenueAmount: 150, laborAmount: 400 }],
    })
    expect(result.accrued.revenueBreakdown?.repairs).toEqual({ total: 150, labor: 150, parts: 0, count: 1 })
  })
})

describe('casos de reparaciones', () => {
  it('avisa cuando se entregó una reparación sin precio', () => {
    const result = summary({
      repairs: [{ ...repairPaidAtPos.repairs[0], revenueAmount: 0, paidAmount: 0 }],
    })
    expect(result.coverageWarnings).toEqual([expect.objectContaining({ code: 'MISSING_REPAIR_PRICE', sourceLabel: 'Reparación R-1' })])
    expect(result.complete).toBe(false)
  })

  it('una reparación todavía en el taller no es ingreso', () => {
    const result = summary({
      repairs: [{ ...repairPaidAtPos.repairs[0], status: 'en_proceso', deliveredAt: null }],
    })
    expect(result.accrued.revenue).toBe(0)
    expect(result.accrued.revenueBreakdown?.repairs.count).toBe(0)
  })

  it('las cuotas de una reparación financiada entran en caja', () => {
    const result = summary({
      creditPayments: [{ saleId: 'repair-credit:c1', branchId: null, paymentDate: '2026-08-20T10:00:00Z', paymentMethod: 'cash', status: 'completed', amount: 120 }],
    })
    expect(result.cash.collected).toBe(120)
  })
})

describe('rentabilidad por venta y por reparación', () => {
  const records = {
    ...base,
    ...repairPaidAtPos,
    repairParts: [
      { repairId: 'repair-1', quantity: 1, unitCost: 80, status: 'installed' },
      { repairId: 'repair-1', quantity: 1, unitCost: 999, status: 'pending' },
    ],
    sales: [
      { id: 'sale-pos', code: 'V-POS', branchId: null, createdAt: '2026-08-10T10:00:00Z', status: 'completed', totalAmount: 500, paidAmount: 500 },
      { id: 'sale-2', code: 'V-2', branchId: null, createdAt: '2026-08-11T10:00:00Z', status: 'completed', totalAmount: 300, paidAmount: 300 },
    ],
    saleItems: [{ saleId: 'sale-2', productId: 'cable', quantity: 1, unitCost: 100, revenueAmount: 300 }],
  } as Records

  it('«Por venta» no lista reparaciones ni la venta que solo saldó una', () => {
    const rows = buildProfitabilityRows(records, period, 'sale')
    expect(rows.map((row) => row.label)).toEqual(['V-2'])
  })

  it('«Por reparación» no lista ventas y cuenta solo los repuestos usados', () => {
    const rows = buildProfitabilityRows(records, period, 'repair')
    expect(rows).toEqual([expect.objectContaining({ label: 'R-1', revenue: 500, directCosts: 80, grossProfit: 420 })])
  })
})

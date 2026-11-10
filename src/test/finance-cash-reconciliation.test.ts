import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: vi.fn() }))

import { buildFinanceSummaryFromRecords } from '@/lib/finance/server'
import { normalizeCashMovementMethod, summarizeCashMovements } from '@/lib/cash/movement-totals'
import { pickCashSession } from '@/lib/repairs/cash-session'

const period = { startDate: '2026-10-01', endDate: '2026-10-31' }
const base = { sales: [], saleItems: [], repairs: [], repairParts: [], obligations: [], payrollEntries: [], financePayments: [], payrollPayments: [] }
type Records = Parameters<typeof buildFinanceSummaryFromRecords>[0]
const summary = (records: Partial<Records>) => buildFinanceSummaryFromRecords({ ...base, ...records } as Records, period, '2026-11-01')

const sale = { id: 's1', code: 'V-1', branchId: null, createdAt: '2026-10-10T12:00:00Z', status: 'completed', totalAmount: 1_000_000, paidAmount: 0 }
const cardPayment = { saleId: 's1', branchId: null, paymentDate: '2026-10-10T12:00:00Z', paymentMethod: 'card', status: 'completed', amount: 1_000_000 }

describe('cobros con tarjeta o QR', () => {
  it('la comisión del banco es gasto y no llega a la cuenta', () => {
    const result = summary({ sales: [sale], salePayments: [{ ...cardPayment, feeAmount: 40_000 }] })
    expect(result.accrued.operatingExpenses).toBe(40_000)
    expect(result.cash.collected).toBe(1_000_000)
    expect(result.cash.paid).toBe(40_000)
  })

  it('un cobro rechazado al conciliar no entra y avisa', () => {
    const result = summary({ sales: [sale], salePayments: [{ ...cardPayment, status: 'rejected' }] })
    expect(result.cash.collected).toBe(0)
    expect(result.coverageWarnings.map((warning) => warning.code)).toContain('REJECTED_PAYMENT')
    expect(result.coverageWarnings.find((warning) => warning.code === 'REJECTED_PAYMENT')?.sourceLabel).toBe('Venta V-1')
  })
})

describe('diferencias de arqueo', () => {
  it('un faltante es gasto y plata que salió', () => {
    const result = summary({ cashClosures: [{ id: 'c1', branchId: null, closedAt: '2026-10-11T23:00:00Z', discrepancy: -50_000 }] })
    expect(result.accrued.operatingExpenses).toBe(50_000)
    expect(result.cash.paid).toBe(50_000)
  })

  it('un sobrante es ingreso y plata que entró', () => {
    const result = summary({ cashClosures: [{ id: 'c2', branchId: null, closedAt: '2026-10-11T23:00:00Z', discrepancy: 20_000 }] })
    expect(result.accrued.revenue).toBe(20_000)
    expect(result.accrued.revenueBreakdown?.cashOverage).toBe(20_000)
    expect(result.cash.collected).toBe(20_000)
  })

  it('un cierre de otro mes no cuenta', () => {
    const result = summary({ cashClosures: [{ id: 'c3', branchId: null, closedAt: '2026-11-02T12:00:00Z', discrepancy: -50_000 }] })
    expect(result.cash.paid).toBe(0)
  })
})

describe('pago a técnico anulado en otro mes', () => {
  const payment = { id: 't1', branchId: null, paidAt: '2026-09-28T12:00:00Z', amount: 300_000, method: 'efectivo', status: 'anulado', voidedAt: '2026-10-05T12:00:00Z' }

  it('la plata vuelve el día de la anulación', () => {
    expect(summary({ technicianPayments: [payment] }).cash.paid).toBe(-300_000)
  })

  it('el mes del pago no se reescribe', () => {
    const september = buildFinanceSummaryFromRecords(
      { ...base, technicianPayments: [payment] } as Records,
      { startDate: '2026-09-01', endDate: '2026-09-30' },
      '2026-11-01',
    )
    expect(september.cash.paid).toBe(300_000)
  })

  it('anulado el mismo mes no suma nada', () => {
    expect(summary({ technicianPayments: [{ ...payment, paidAt: '2026-10-02T12:00:00Z' }] }).cash.paid).toBe(0)
  })
})

describe('repuesto devuelto sin producto', () => {
  const repair = { id: 'r1', ticketNumber: 'R-1', branchId: null, createdAt: '2026-10-01T12:00:00Z', deliveredAt: '2026-10-12T12:00:00Z', status: 'entregado', revenueAmount: 30_000, paidAmount: 30_000 }

  it('sigue siendo costo si el cierre no lo marcó como devuelto al stock', () => {
    // El cierre ya filtra: un repuesto sin producto no figura en restockedPartIds.
    const result = summary({
      repairs: [repair],
      repairParts: [{ id: 'p1', repairId: 'r1', quantity: 1, unitCost: 80_000, status: 'installed' }],
      repairCloseouts: [{ repairId: 'r1', branchId: null, createdAt: '2026-10-12T12:00:00Z', restockedPartIds: [], refundAmount: 0, refundMethod: null }],
    })
    expect(result.accrued.directCosts).toBe(80_000)
  })
})

describe('movimientos de caja', () => {
  it('reconoce los medios guardados en español', () => {
    expect(normalizeCashMovementMethod('tarjeta')).toBe('card')
    expect(normalizeCashMovementMethod('transferencia')).toBe('transfer')
    expect(normalizeCashMovementMethod('efectivo')).toBe('cash')
    expect(normalizeCashMovementMethod(null)).toBe('cash')
  })

  it('suma ventas por medio, ingresos y egresos', () => {
    const totals = summarizeCashMovements([
      { id: 'a', type: 'sale', amount: 800_000, payment_method: 'efectivo', sale_id: 's1' },
      { id: 'b', type: 'sale', amount: 300_000, payment_method: 'tarjeta', sale_id: 's1' },
      { id: 'c', type: 'cash_in', amount: 50_000, payment_method: 'efectivo' },
      { id: 'd', type: 'cash_out', amount: 20_000, payment_method: 'efectivo' },
    ])
    expect(totals).toMatchObject({ total: 4, salesCount: 1, totalSales: 1_100_000, salesCash: 800_000, salesCard: 300_000, cashIn: 50_000, cashOut: 20_000 })
  })
})

describe('caja de un cobro de reparación', () => {
  const sessions = [
    { id: 'caja-2', opened_by: 'ana' },
    { id: 'caja-1', opened_by: 'beto' },
  ]

  it('usa la caja que abrió quien cobra', () => {
    expect(pickCashSession(sessions, 'beto')).toBe('caja-1')
  })

  it('si no abrió ninguna, la más reciente', () => {
    expect(pickCashSession(sessions, 'carla')).toBe('caja-2')
    expect(pickCashSession([], 'beto')).toBeNull()
  })
})

describe('seña de una reparación cancelada', () => {
  const closeout = { id: 'c1', repairId: 'r9', branchId: null, createdAt: '2026-10-20T12:00:00Z', outcome: 'cancelled', restockedPartIds: [], refundAmount: 0, refundMethod: null }

  it('retenida, es ingreso de reparaciones el día que se decide', () => {
    const result = summary({ repairCloseouts: [{ ...closeout, finalCharge: 40_000 }] })
    expect(result.accrued.revenue).toBe(40_000)
    expect(result.accrued.revenueBreakdown?.repairs.total).toBe(40_000)
    expect(result.cash.collected).toBe(0)
  })

  it('devuelta en efectivo, sale de caja y no es ingreso', () => {
    const result = summary({ repairCloseouts: [{ ...closeout, finalCharge: 0, refundAmount: 50_000, refundMethod: 'cash' }] })
    expect(result.accrued.revenue).toBe(0)
    expect(result.cash.paid).toBe(50_000)
  })
})

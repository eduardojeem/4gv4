import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: vi.fn() }))

import { allFinanceRows, buildFinanceSummaryFromRecords, dayStartUtc } from '@/lib/finance/server'

/** Consulta falsa: devuelve `total` filas numeradas, de a `range`. */
function fakeQuery(total: number) {
  const calls: Array<[number, number]> = []
  const query = {
    range(from: number, to: number) {
      calls.push([from, to])
      const data = Array.from({ length: Math.max(0, Math.min(to, total - 1) - from + 1) }, (_, i) => ({ id: from + i }))
      return Promise.resolve({ data, error: null, count: total }) as never
    },
  }
  return { query, calls }
}

describe('el informe no se corta en 1000 filas', () => {
  it('trae todas las páginas', async () => {
    const { query, calls } = fakeQuery(2_350)
    const result = await allFinanceRows(query as never)
    expect((result as { data: unknown[] }).data).toHaveLength(2_350)
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it('una sola página si alcanza', async () => {
    const { query, calls } = fakeQuery(40)
    expect(((await allFinanceRows(query as never)) as { data: unknown[] }).data).toHaveLength(40)
    expect(calls).toHaveLength(1)
  })

  it('pasado el tope del informe no descarga todo: deja que el control de tamaño lo rechace', async () => {
    const { query, calls } = fakeQuery(25_000)
    const result = (await allFinanceRows(query as never)) as { data: unknown[]; count: number }
    expect(calls).toHaveLength(1)
    expect(result.count).toBe(25_000)
  })
})

const base = { sales: [], saleItems: [], repairs: [], repairParts: [], obligations: [], payrollEntries: [], financePayments: [], payrollPayments: [] }
type Records = Parameters<typeof buildFinanceSummaryFromRecords>[0]

describe('los días se cortan en la zona del negocio', () => {
  it('el 1/11 en Asunción empieza a las 03:00Z', () => {
    expect(dayStartUtc('2026-11-01', 'America/Asuncion')).toBe('2026-11-01T03:00:00.000Z')
  })

  it('una venta del 31/10 a las 22:30 en Paraguay es de octubre, no de noviembre', () => {
    const records = {
      ...base,
      sales: [{ id: 's1', branchId: null, createdAt: '2026-11-01T01:30:00Z', status: 'completed', totalAmount: 300_000, paidAmount: 0 }],
      saleItems: [{ saleId: 's1', quantity: 1, unitCost: 100_000, revenueAmount: 300_000 }],
    } as Records
    const october = buildFinanceSummaryFromRecords(records, { startDate: '2026-10-01', endDate: '2026-10-31', timeZone: 'America/Asuncion' }, '2026-11-02')
    const november = buildFinanceSummaryFromRecords(records, { startDate: '2026-11-01', endDate: '2026-11-30', timeZone: 'America/Asuncion' }, '2026-11-02')
    expect(october.accrued.revenue).toBe(300_000)
    expect(november.accrued.revenue).toBe(0)
  })

  it('una nómina aprobada el último día a la tarde entra en ese período', () => {
    const records = {
      ...base,
      payrollEntries: [{ id: 'p1', branchId: null, approvedAt: '2026-10-31T18:00:00Z', status: 'approved', netAmount: 5_000_000 }],
    } as Records
    const october = buildFinanceSummaryFromRecords(records, { startDate: '2026-10-01', endDate: '2026-10-31', timeZone: 'America/Asuncion' }, '2026-11-02')
    expect(october.accrued.payrollCost).toBe(5_000_000)
  })
})

describe('comparación con el período anterior', () => {
  it('un mes completo se compara con el mes anterior completo', () => {
    const records = {
      ...base,
      sales: [
        { id: 'sep-1', branchId: null, createdAt: '2026-09-01T12:00:00Z', status: 'completed', totalAmount: 100, paidAmount: 0 },
        { id: 'aug-31', branchId: null, createdAt: '2026-08-31T12:00:00Z', status: 'completed', totalAmount: 999, paidAmount: 0 },
      ],
      saleItems: [
        { saleId: 'sep-1', quantity: 1, unitCost: 10, revenueAmount: 100 },
        { saleId: 'aug-31', quantity: 1, unitCost: 10, revenueAmount: 999 },
      ],
    } as Records
    const result = buildFinanceSummaryFromRecords(records, { startDate: '2026-10-01', endDate: '2026-10-31' }, '2026-11-02')
    // Septiembre completo (1/9 al 30/9): el 31/8 ya no entra.
    expect(result.comparison.accrued.revenue).toBe(100)
  })
})

describe('costos con centavos', () => {
  it('no rompen el resumen', () => {
    const records = {
      ...base,
      sales: [{ id: 's1', branchId: null, createdAt: '2026-10-05T12:00:00Z', status: 'completed', totalAmount: 30_000, paidAmount: 0 }],
      saleItems: [{ saleId: 's1', quantity: 3, unitCost: 7000.08, revenueAmount: 30_000 }],
    } as Records
    const result = buildFinanceSummaryFromRecords(records, { startDate: '2026-10-01', endDate: '2026-10-31' }, '2026-11-02')
    expect(result.accrued.directCosts).toBe(21_000.24)
  })
})

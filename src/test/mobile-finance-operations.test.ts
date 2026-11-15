import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn(), context: { userId: 'u', organizationId: 'o', epoch: 1 } }))
vi.mock('../../mobile/src/lib/api', () => ({ apiFetch: mocks.apiFetch }))
vi.mock('../../mobile/src/lib/private-cache-context', () => ({ getPrivateCacheContext: () => mocks.context }))

import { approvePayrollRun, sendFinanceAttempt, voidExpense, type FinanceScope } from '../../mobile/src/lib/finance-admin'
import { readPendingFinanceAttempt, submitFinanceAttempt } from '../../mobile/src/lib/finance-attempt'
import { formatDay, isIsoDay, monthGrid, shiftMonth } from '../../mobile/src/lib/calendar-model'

const scope: FinanceScope = { userId: 'u', organizationId: 'o', epoch: 1, branchId: null, currency: 'PYG', timeZone: 'America/Asuncion', startDate: '2026-11-01', endDate: '2026-11-30' }
const EXPENSE = '11111111-1111-4111-8111-111111111111'
const BRANCH = '22222222-2222-4222-8222-222222222222'

beforeEach(() => { mocks.apiFetch.mockReset(); mocks.apiFetch.mockResolvedValue({ ok: true }); mocks.context = { userId: 'u', organizationId: 'o', epoch: 1 } })

describe('anular gastos desde la app', () => {
  it('manda el motivo y la sucursal del gasto; la caja solo si hubo pagos en efectivo', async () => {
    await voidExpense(scope, { id: EXPENSE, branch_id: BRANCH }, '  Cargado dos veces  ')
    expect(mocks.apiFetch).toHaveBeenCalledWith(`/api/admin/finances/obligations/${EXPENSE}?organizationId=o`, { method: 'DELETE', body: JSON.stringify({ branchId: BRANCH, reason: 'Cargado dos veces' }) })
    await voidExpense(scope, { id: EXPENSE, branch_id: BRANCH }, 'Error', 'caja-1')
    expect(JSON.parse(mocks.apiFetch.mock.calls[1][1].body)).toEqual({ branchId: BRANCH, reason: 'Error', cashSessionId: 'caja-1' })
  })

  it('no anula sin motivo, de otra sucursal ni si cambió la empresa', async () => {
    await expect(voidExpense(scope, { id: EXPENSE, branch_id: BRANCH }, '   ')).rejects.toThrow(/motivo/)
    await expect(voidExpense({ ...scope, branchId: 'otra' }, { id: EXPENSE, branch_id: BRANCH }, 'x')).rejects.toThrow(/otra sucursal/)
    mocks.context = { userId: 'u', organizationId: 'otra', epoch: 1 }
    await expect(voidExpense(scope, { id: EXPENSE, branch_id: BRANCH }, 'x')).rejects.toThrow(/cambiaron/)
    expect(mocks.apiFetch).not.toHaveBeenCalled()
  })
})

describe('sueldos desde la app', () => {
  it('aprueba la liquidación con un POST a su ruta', async () => {
    await approvePayrollRun(scope, 'run-1')
    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/admin/finances/payroll/run-1/approve?organizationId=o', { method: 'POST' })
  })

  it('paga un sueldo con clave de idempotencia y sin sucursal en el pedido', async () => {
    await sendFinanceAttempt(scope, { kind: 'payroll_payment', targetId: 'entry-1', payload: { amount: 1500000, paymentMethod: 'bank_transfer', paymentDate: '2026-11-15' } }, 'clave-1')
    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/admin/finances/payroll/entry-1/payments?organizationId=o', {
      method: 'POST', headers: { 'x-idempotency-key': 'clave-1' }, body: JSON.stringify({ amount: 1500000, paymentMethod: 'bank_transfer', paymentDate: '2026-11-15' }),
    })
  })

  it('un pago de sueldo que quedó a medias se recupera con la misma clave', async () => {
    const data = new Map<string, string>()
    const store = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } }
    const attempt = { kind: 'payroll_payment' as const, targetId: 'entry-1', payload: { amount: 100, paymentMethod: 'cash', paymentDate: '2026-11-15', cashSessionId: 'caja' } }
    const keys: string[] = []
    const send = vi.fn(async (_input: unknown, key: string) => { keys.push(key); if (keys.length === 1) throw new Error('timeout'); return {} })
    await expect(submitFinanceAttempt({ userId: 'u', organizationId: 'o' }, attempt, store, send)).rejects.toThrow()
    expect((await readPendingFinanceAttempt({ userId: 'u', organizationId: 'o' }, store))?.kind).toBe('payroll_payment')
    await submitFinanceAttempt({ userId: 'u', organizationId: 'o' }, attempt, store, send)
    expect(keys[0]).toBe(keys[1])
  })
})

describe('calendario de fechas', () => {
  it('arma el mes empezando en lunes', () => {
    // 1/11/2026 es domingo: seis huecos antes.
    const weeks = monthGrid(2026, 10)
    expect(weeks[0]).toEqual([null, null, null, null, null, null, 1])
    expect(weeks.flat().filter(Boolean)).toHaveLength(30)
    expect(weeks.every(week => week.length === 7)).toBe(true)
  })

  it('valida y muestra fechas como en Paraguay', () => {
    expect(isIsoDay('2026-02-29')).toBe(false)
    expect(isIsoDay('2028-02-29')).toBe(true)
    expect(formatDay('2026-11-05')).toBe('05/11/2026')
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, monthIndex: 11 })
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, monthIndex: 0 })
  })
})

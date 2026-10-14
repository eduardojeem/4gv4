import { describe, expect, it } from 'vitest'
import { computeTechnicianEarnings, getTechnicianCompensation, qualifiesForAccrual } from '@/lib/technician/earnings-server'
import type { SupabaseClient } from '@supabase/supabase-js'

describe('technician disbursed balance', () => {
  it('does not count pending or cancelled amounts as paid', async () => {
    const { sumDisbursedPayments } = await import('@/lib/technician/payment-summary')
    expect(sumDisbursedPayments([
      { status: 'pendiente', amount: 300000 }, { status: 'anulado', amount: 90000 },
      { status: 'pagado', amount: 100000 }, { status: 'confirmado', amount: '50000' },
    ])).toBe(150000)
  })
})

describe('technician accrual dates', () => {
  const repair = { status: 'entregado', completed_at: '2026-09-29T12:00:00Z', delivered_at: '2026-10-02T12:00:00Z' }
  it('uses delivery date for delivery-based earnings across months', () => {
    expect(qualifiesForAccrual(repair, 'entregado', '2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z')).toBe(true)
    expect(qualifiesForAccrual(repair, 'entregado', '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z')).toBe(false)
  })
  it('uses completion date for completion-based earnings', () => {
    expect(qualifiesForAccrual(repair, 'listo', '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z')).toBe(true)
  })
  it('does not assume an undocumented delivery date', () => {
    expect(qualifiesForAccrual({ ...repair, delivered_at: null }, 'entregado', '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z')).toBe(false)
  })
  it('rejects invalid calendar timestamps', () => {
    expect(qualifiesForAccrual({ ...repair, delivered_at: '2026-10-99T12:00:00Z' }, 'entregado', '2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z')).toBe(false)
  })
})

describe('technician data completeness', () => {
  it('does not turn a configuration query failure into zero earnings', async () => {
    const query = { select() { return this }, eq() { return this }, maybeSingle: async () => ({ data: null, error: new Error('database unavailable') }) }
    const client = { from: () => query } as unknown as SupabaseClient
    await expect(getTechnicianCompensation(client, 'organization', 'technician')).rejects.toThrow('database unavailable')
  })
  it('rejects invalid periods before querying data', async () => {
    const client = { from: () => { throw new Error('unexpected query') } } as unknown as SupabaseClient
    await expect(computeTechnicianEarnings(client, 'org', 'tech', null, 'not a date', '2026-11-01')).rejects.toThrow('Período inválido')
  })
  it('includes repairs after the first database page', async () => {
    const repair = { status: 'entregado', delivered_at: '2026-10-02T12:00:00Z', labor_cost: 100 }
    const query = {
      select() { return this }, eq() { return this }, order() { return this },
      range: async (from: number) => ({ data: from === 0 ? Array.from({ length: 200 }, () => repair) : [repair], error: null }),
      then(resolve: (value: unknown) => unknown) { return Promise.resolve(resolve({ data: Array.from({ length: 200 }, () => repair), error: null })) },
    }
    const configuration = { select() { return this }, eq() { return this }, maybeSingle: async () => ({ data: { commission_rate: 10 }, error: null }) }
    const versions = { select() { return this }, eq() { return this }, order() { return this }, range: async () => ({ data: [], error: null }) }
    const settings = { select() { return this }, eq() { return this }, maybeSingle: async () => ({ data: { timezone: 'UTC' }, error: null }) }
    const client = { from: (table: string) => table === 'technician_compensation' ? configuration : table === 'technician_compensation_versions' ? versions : table === 'organization_settings' ? settings : query } as unknown as SupabaseClient
    const { earnings } = await computeTechnicianEarnings(client, 'org', 'tech', null, '2026-10-01', '2026-11-01')
    expect(earnings.repairsCount).toBe(201)
    expect(earnings.total).toBe(2010)
  })
})

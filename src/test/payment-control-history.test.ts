// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaymentControl } from '@/lib/payments/control-contract'
const state = vi.hoisted(() => ({ calls: [] as unknown[][], result: { data: [] as unknown[] | null, error: null as unknown } }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => ({ from: (table: string) => {
  state.calls.push(['from', table])
  const query: Record<string, unknown> = {}
  for (const key of ['select', 'eq', 'in', 'gt']) query[key] = (...args: unknown[]) => { state.calls.push([key, ...args]); return query }
  query.limit = () => Promise.resolve(state.result)
  return query
} }) }))
import { paymentEvidence, subscriptionControlHistory, commerceControlHistory } from '@/lib/payments/control-history'
const method = (id: string): PaymentControl => ({ id, title: id, description: '', channels: [], configured: true, enabled: true, editable: true, available: true })
beforeEach(() => { state.calls = []; state.result = { data: [], error: null } })
describe('payment history evidence', () => {
  it('does not report zero payments when a source failed', () => {
    expect(paymentEvidence([{ data: null, error: true }], '')?.confirmed).toBeNull()
    expect(paymentEvidence([{ data: [], error: null }], '')?.confirmed).toBe(false)
    expect(paymentEvidence([{ data: [{ id: 'x' }], error: null }, { data: null, error: true }], '')?.confirmed).toBe(true)
  })
  it('counts only paid positive subscription payments with exact provider and method, not activations', async () => {
    await subscriptionControlHistory([method('pagopar_qr'), method('promo')])
    expect(state.calls).toContainEqual(['eq', 'status', 'paid'])
    expect(state.calls).toContainEqual(['gt', 'amount', 0])
    expect(state.calls).toContainEqual(['eq', 'provider', 'pagopar'])
    expect(state.calls).toContainEqual(['eq', 'payment_method', 'Pagopar QR'])
    expect(state.calls.filter(call => call[0] === 'from')).toHaveLength(1)
  })
  it('scopes every commerce source to the server organization and excludes financing from money collection', async () => {
    await commerceControlHistory([method('cash'), method('credit'), method('store_credit')], 'org-a')
    expect(state.calls.filter(call => call[0] === 'from')).toHaveLength(3)
    expect(state.calls.filter(call => call[0] === 'eq' && call[1] === 'organization_id')).toEqual(Array(3).fill(['eq', 'organization_id', 'org-a']))
    expect(state.calls).toContainEqual(['eq', 'sales.organization_id', 'org-a'])
    expect(state.calls).toContainEqual(['eq', 'status', 'completed'])
    expect(state.calls).toContainEqual(['gt', 'immediate_amount', 0])
  })
  it('identifies QR by its channel rather than attributing every transfer to QR', async () => {
    await commerceControlHistory([method('qr')], 'org-b')
    expect(state.calls).toContainEqual(['eq', 'channel', 'qr'])
    expect(state.calls.filter(call => call[0] === 'from')).toHaveLength(1)
  })
})

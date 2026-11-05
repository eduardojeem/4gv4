import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>>, fail: false, race: false,
  updates: [] as Array<{ table: string; patch: Record<string, unknown>; filters: Record<string, unknown> }>,
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => ({
  rpc: async (name: string, args: Record<string, unknown>) => {
    if (name === 'commerce_payment_controls_version') return { data: 2, error: null }
    const table = args.p_scope === 'commerce' ? 'organization_settings' : 'system_settings'
    const column = args.p_scope === 'commerce' ? 'modules' : 'features'
    const row = state.rows[table]
    if (state.race || !row || row.updated_at !== args.p_revision) return { data: null, error: { message: 'PAYMENT_CONTROLS_CONFLICT' } }
    const container = row[column] as Record<string, unknown>
    const patch = { [column]: { ...container, payment_controls: { ...((container.payment_controls ?? {}) as Record<string, boolean>), [String(args.p_method)]: args.p_enabled } } }
    state.updates.push({ table, patch, filters: { organization_id: args.p_organization_id, updated_at: args.p_revision } })
    return { data: { updated_at: 'new-revision' }, error: null }
  },
  from: (table: string) => {
  let patch: Record<string, unknown> | null = null
  const filters: Record<string, unknown> = {}
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => { filters[key] = value; return query },
    is: (key: string, value: unknown) => { filters[key] = value; return query },
    update: (next: Record<string, unknown>) => { patch = next; return query },
    maybeSingle: async () => {
      if (state.fail) return { data: null, error: { message: 'private SQL details' } }
      const row = state.rows[table]
      if (!patch) return { data: row ?? null, error: null }
      state.updates.push({ table, patch, filters })
      if (state.race || !row || row.updated_at !== filters.updated_at) return { data: null, error: null }
      state.rows[table] = { ...row, ...patch }
      return { data: { updated_at: patch.updated_at }, error: null }
    },
  }
  return query
} }) }))
import { assertCommercePayments, readPaymentControlPolicy, updatePaymentControlPolicy } from '@/lib/payments/control-store'
beforeEach(() => { state.rows = {}; state.fail = false; state.race = false; state.updates = [] })
describe('uncached payment policy storage', () => {
  it('distinguishes a missing policy from an unavailable database and does not expose SQL', async () => {
    expect((await readPaymentControlPolicy('commerce', 'org')).flags.cash).toBe(true)
    state.fail = true
    await expect(readPaymentControlPolicy('commerce', 'org')).rejects.toThrow('No se pudieron consultar')
    await expect(assertCommercePayments('org', [{ method: 'cash' }])).rejects.not.toThrow('private SQL')
  })
  it('scopes a tenant write and preserves unrelated settings', async () => {
    state.rows.organization_settings = { modules: { repairs: true, admin_settings: { city: 'Test' } }, updated_at: null }
    await updatePaymentControlPolicy({ scope: 'commerce', organizationId: 'org-a', id: 'cash', enabled: false, revision: null, actorId: 'actor' })
    expect(state.updates[0].filters).toEqual({ organization_id: 'org-a', updated_at: null })
    expect(state.updates[0].patch.modules).toMatchObject({ repairs: true, admin_settings: { city: 'Test' }, payment_controls: { cash: false } })
  })
  it('rejects a stale form and a concurrent write after the read', async () => {
    state.rows.system_settings = { features: { branding: 'preserve' }, updated_at: '2026-11-01T00:00:00.000Z' }
    await expect(updatePaymentControlPolicy({ scope: 'subscriptions', id: 'stripe', enabled: false, revision: null, actorId: 'actor' })).rejects.toMatchObject({ status: 409 })
    expect(state.updates).toHaveLength(0)
    state.race = true
    await expect(updatePaymentControlPolicy({ scope: 'subscriptions', id: 'stripe', enabled: false, revision: '2026-11-01T00:00:00.000Z', actorId: 'actor' })).rejects.toMatchObject({ code: 'PAYMENT_CONTROLS_CONFLICT' })
  })
  it('checks a fresh policy for each new operation and rejects unknown keys before writing', async () => {
    state.rows.organization_settings = { modules: {}, updated_at: null }
    await assertCommercePayments('org', [{ method: 'cash' }])
    state.rows.organization_settings.modules = { payment_controls: { cash: false } }
    await expect(assertCommercePayments('org', [{ method: 'cash' }])).rejects.toMatchObject({ status: 409 })
    await expect(updatePaymentControlPolicy({ scope: 'commerce', organizationId: 'org', id: '__proto__', enabled: true, revision: null, actorId: 'actor' })).rejects.toMatchObject({ status: 400 })
  })
})

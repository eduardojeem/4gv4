// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { saveCreditDefaults } from '@/lib/credits/save-credit-defaults'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import type { createAdminSupabase } from '@/lib/supabase/admin'

function fixture() {
  let row: Record<string, unknown> | null = { key: 'product_credit_defaults', organization_id: 'org-a', updated_at: '2026-11-04T12:00:00.000Z', value: {} }
  const client = { from: () => {
    let patch: Record<string, unknown> = {}, insert = false
    const filters: Array<[string, unknown]> = []
    const query = {
      insert(value: Record<string, unknown>) { patch = value; insert = true; return query },
      update(value: Record<string, unknown>) { patch = value; return query },
      eq(key: string, value: unknown) { filters.push([key, value]); return query },
      is(key: string, value: unknown) { filters.push([key, value]); return query },
      select: () => query,
      maybeSingle: async () => {
        if (insert && row) return { data: null, error: { code: '23505' } }
        if (!insert && (!row || filters.some(([key, value]) => row?.[key] !== value))) return { data: null, error: null }
        row = patch
        return { data: row, error: null }
      },
    }
    return query
  } } as unknown as ReturnType<typeof createAdminSupabase>
  return { client, read: () => row, clear: () => { row = null } }
}
const input = { organizationId: 'org-a', actorId: 'owner', revision: '2026-11-04T12:00:00.000Z', value: getWebsiteSettingsDefaults().product_credit_defaults! }
describe('versioned credit defaults', () => {
  it('keeps the first administrator change and rejects a stale second save', async () => {
    const db = fixture()
    await saveCreditDefaults(db.client, input)
    await expect(saveCreditDefaults(db.client, { ...input, value: { ...input.value, enabled: false } })).rejects.toMatchObject({ status: 409 })
    expect(db.read()?.value).toMatchObject({ enabled: true })
  })
  it('rejects a stale organization and a competing initial insert', async () => {
    const db = fixture()
    await expect(saveCreditDefaults(db.client, { ...input, organizationId: 'org-b' })).rejects.toMatchObject({ status: 409 })
    await expect(saveCreditDefaults(db.client, { ...input, revision: 'missing' })).rejects.toMatchObject({ status: 409 })
  })
  it('creates missing defaults without an upsert that overwrites another editor', async () => {
    const db = fixture(); db.clear()
    await saveCreditDefaults(db.client, { ...input, revision: 'missing' })
    expect(db.read()?.organization_id).toBe('org-a')
  })
})

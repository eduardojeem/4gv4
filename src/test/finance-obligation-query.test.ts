import { beforeEach, expect, it, vi } from 'vitest'
const { admin } = vi.hoisted(() => ({ admin: { from: vi.fn() } }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => admin }))
import { listObligations } from '@/lib/finance/server'

function query() {
  const value: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const name of ['select', 'eq', 'in', 'order', 'range', 'gte', 'lte', 'lt', 'or']) value[name] = vi.fn(() => value)
  value.then = vi.fn((resolve) => resolve({ data: [], count: 0, error: null }))
  return value
}
beforeEach(() => vi.clearAllMocks())

it('quotes search punctuation while retaining organization and branch constraints', async () => {
  const rows = query()
  admin.from.mockReturnValue(rows)
  const term = 'Alquiler",status.eq.paid'
  await listObligations('org-a', { branchId: 'branch-a', search: term, page: 2, pageSize: 50 })
  expect(rows.eq).toHaveBeenCalledWith('organization_id', 'org-a')
  expect(rows.eq).toHaveBeenCalledWith('branch_id', 'branch-a')
  expect(rows.range).toHaveBeenCalledWith(50, 99)
  const literal = JSON.stringify(`%${term}%`)
  expect(rows.or).toHaveBeenCalledWith(`concept.ilike.${literal},vendor.ilike.${literal}`)
})

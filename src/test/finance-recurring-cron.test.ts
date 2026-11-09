import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const rpc = vi.fn()
const templates = [{ id: 't1', organization_id: 'org-a' }, { id: 't2', organization_id: 'org-a' }, { id: 't3', organization_id: 'org-b' }]
function query(rows: unknown[]) {
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'order']) chain[method] = () => chain
  chain.range = () => Promise.resolve({ data: rows, error: null, count: rows.length })
  chain.maybeSingle = () => Promise.resolve({ data: { timezone: 'America/Asuncion' }, error: null })
  return chain
}
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({
    from: (table: string) => query(table === 'finance_expense_templates' ? templates : []),
    rpc: (...args: unknown[]) => rpc(...args),
  }),
}))

import { generateRecurringObligationsForAllOrganizations } from '@/lib/finance/server'

describe('gastos recurrentes desde el cron diario', () => {
  it('genera el período de hoy una vez por negocio con plantillas activas', async () => {
    rpc.mockResolvedValueOnce({ data: 2, error: null }).mockResolvedValueOnce({ data: null, error: { message: 'x' } })
    const result = await generateRecurringObligationsForAllOrganizations()
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(rpc.mock.calls.map((call) => (call[1] as { p_organization_id: string }).p_organization_id)).toEqual(['org-a', 'org-b'])
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_generation_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })
    expect(result).toEqual({ organizations: 2, created: 2, failed: 1 })
  })
})

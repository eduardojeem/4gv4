import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ fail: '' }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => ({ from: (table: string) => {
  const result = () => ({ error: table === state.fail ? { message: 'unavailable' } : null, data: table === 'subscriptions' ? { plan: 'FREE' } : table === 'organizations' ? { plan: 'FREE', business_vertical: 'general', operating_model: 'retail' } : table === 'plans' ? [{ code: 'FREE', name: 'Free', modules: ['pos', 'inventory'], limits: {} }] : [] })
  const query = { select: () => query, eq: () => query, maybeSingle: async () => result(), then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve) }
  return query
} }) }))
import { getOrganizationPlanInfo } from '@/lib/saas/subscription-service'
beforeEach(() => { state.fail = '' })
describe('strict preparation plan evidence', () => {
  it.each(['subscriptions', 'organizations', 'organization_module_trials', 'plans'])('rejects unavailable %s instead of defaulting readiness', async table => {
    state.fail = table
    await expect(getOrganizationPlanInfo('org', { strict: true })).rejects.toThrow()
  })
  it('uses persisted modules when all evidence is available', async () => {
    expect((await getOrganizationPlanInfo('org', { strict: true })).effectiveModules).toContain('pos')
  })
})

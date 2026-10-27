import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ role: 'owner', modules: ['pos', 'inventory'], failTable: '', filters: [] as Array<{ table: string; key: string; value: unknown }>, tables: {} as Record<string, unknown>, rpc: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/saas/context', () => ({ getCurrentOrganizationContext: async () => ({ id: 'org', name: 'Business', role: state.role }) }))
vi.mock('@/lib/saas/subscription-service', () => ({ getOrganizationPlanInfo: async (_id: string, options?: { strict: boolean }) => {
  if (!options?.strict) throw new Error('Guide requires strict persisted plan evidence')
  return { effectiveModules: state.modules, businessVertical: 'general', operatingModel: 'retail' }
} }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => ({ rpc: state.rpc, from: (table: string) => {
  const result = () => ({ data: state.tables[table] ?? [], error: state.failTable === table ? { message: 'failed' } : null })
  const query = {
    select: () => query, eq: (key: string, value: unknown) => { state.filters.push({ table, key, value }); return query },
    neq: () => query, gte: () => query, gt: () => query, in: () => query, is: () => query, limit: () => query,
    maybeSingle: async () => result(), then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
  }
  return query
} }) }))
import { loadStartGuide, saveStartGuidePreferences } from '@/lib/onboarding/start-guide-server'
beforeEach(() => {
  state.role = 'owner'; state.modules = ['pos', 'inventory']; state.failTable = ''; state.filters = []; state.rpc.mockReset()
  state.tables = { organization_settings: { display_name: 'Business', currency: 'PYG', timezone: 'America/Asuncion', modules: {} }, branches: [{ id: 'branch' }] }
})
describe('business guide server', () => {
  it('recognizes stocked variants when the parent has no stock', async () => {
    state.tables.product_variants = [{ id: 'variant' }]
    const result = await loadStartGuide('actor')
    expect(result.guide.tasks.find(task => task.id === 'catalog')?.state).toBe('ready')
    expect(state.filters).toContainEqual({ table: 'product_variants', key: 'products.organization_id', value: 'org' })
  })
  it('rejects a non-administrator before reading evidence', async () => {
    state.role = 'seller'
    await expect(loadStartGuide('actor')).rejects.toMatchObject({ status: 403 })
    expect(state.filters).toEqual([])
  })
  it('scopes every table lookup to the current organization', async () => {
    await loadStartGuide('actor', 'branch')
    // organizations se acota por su propio id; el resto, por organization_id.
    for (const table of new Set(state.filters.map(filter => filter.table))) expect(state.filters).toContainEqual({ table, key: table === 'organizations' ? 'id' : 'organization_id', value: 'org' })
    expect(state.filters).toContainEqual({ table: 'sales', key: 'branch_id', value: 'branch' })
  })
  it('rejects an unavailable branch', async () => {
    state.tables.branches = []
    await expect(loadStartGuide('actor', 'foreign-branch')).rejects.toMatchObject({ status: 403 })
  })
  it('a catalog error is unknown, not a false success or zero', async () => {
    state.failTable = 'products'
    const result = await loadStartGuide('actor')
    expect(result.guide.tasks.find(task => task.id === 'catalog')?.state).toBe('unknown')
    expect(result.limitations.some(message => message.includes('producto'))).toBe(true)
  })
  it('an unavailable setup checklist is reported, not a broken guide', async () => {
    state.failTable = 'website_settings'
    const result = await loadStartGuide('actor')
    expect(result.setupChecklist).toBeNull()
    expect(result.limitations).toContain('No se pudo comprobar la configuración opcional del negocio.')
    expect(result.guide.tasks.length).toBeGreaterThan(0)
  })
  it('does not query unavailable service or repair modules', async () => {
    await loadStartGuide('actor')
    expect(state.filters.some(filter => ['agenda_settings', 'appointments', 'repairs'].includes(filter.table))).toBe(false)
  })
  it('rejects an obsolete organization before saving preferences', async () => {
    await expect(saveStartGuidePreferences('actor', { version: 1, teamMode: 'solo', postponed: true }, 'other-org')).rejects.toMatchObject({ status: 409 })
    expect(state.rpc).not.toHaveBeenCalled()
  })
  it('saving preferences never rewrites the complete modules object', async () => {
    state.rpc.mockResolvedValue({ error: null })
    await saveStartGuidePreferences('actor', { version: 1, teamMode: 'solo', postponed: true }, 'org')
    expect(state.rpc).toHaveBeenCalledWith('server_save_business_start_guide_preferences', { p_organization_id: 'org', p_actor_user_id: 'actor', p_preferences: { version: 1, teamMode: 'solo', postponed: true } })
  })
})

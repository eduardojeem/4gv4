import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ auth: vi.fn(), org: vi.fn(), rpc: vi.fn(), plan: vi.fn(), capacity: vi.fn() }))
vi.mock('@/lib/auth/request-auth', () => ({ resolveRequestAuthUser: mocks.auth }))
vi.mock('@/lib/saas/context', () => ({ getCurrentOrganizationContext: mocks.org }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => ({ rpc: mocks.rpc }) }))
vi.mock('@/lib/saas/subscription-service', () => ({ getOrganizationPlanInfo: mocks.plan, canCreateResource: mocks.capacity }))
import { POST } from '@/app/api/agenda/services/route'
const body = { requestKey: '00000000-0000-4000-8000-000000000003', name: 'Manicura', price: 0, durationMinutes: 55, catalogVisible: true, online: false }
const req = (input: unknown = body) => new NextRequest('http://localhost/api/agenda/services', { method: 'POST', body: JSON.stringify(input) })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ user: { id: 'actor' } })
  mocks.org.mockResolvedValue({ id: 'tenant', role: 'owner' })
  mocks.plan.mockResolvedValue({ modules: ['services', 'inventory'], entitledModules: [], moduleTrials: [] })
  mocks.capacity.mockResolvedValue({ allowed: true, limit: 50, blocked: false })
  mocks.rpc.mockImplementation(async (name: string) => ({ error: null, data: name === 'agenda_service_policy_revision' ? 'revision' : { id: 'product', replayed: false } }))
})
describe('authorized atomic service endpoint', () => {
  it('uses the real tenant guard and requires both permissions', async () => {
    mocks.auth.mockResolvedValue({ reason: 'unauthenticated' })
    expect((await POST(req())).status).toBe(401)
    mocks.auth.mockResolvedValue({ user: { id: 'actor' } })
    mocks.org.mockResolvedValue({ id: 'tenant', role: 'cashier' })
    expect((await POST(req())).status).toBe(403)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('rejects disabled inventory and client authority fields', async () => {
    mocks.plan.mockResolvedValue({ modules: ['services'], entitledModules: [], moduleTrials: [] })
    expect((await POST(req())).status).toBe(403)
    mocks.plan.mockResolvedValue({ modules: ['services','inventory'] })
    expect((await POST(req({ ...body, organizationId: 'other', limit: null }))).status).toBe(422)
  })
  it('writes once with trusted actor and quota, without resaving settings', async () => {
    expect((await POST(req())).status).toBe(200)
    const writes = mocks.rpc.mock.calls.filter(([name]) => name === 'create_agenda_service')
    expect(writes).toHaveLength(1)
    expect(writes[0][1]).toMatchObject({ p_org: 'tenant', p_actor: 'actor', p_limit: 50, p_input: { price: 0, durationMinutes: 55 } })
  })
  it('rechecks both modules inside the policy bracket', async () => {
    mocks.plan.mockResolvedValueOnce({ modules: ['services','inventory'] }).mockResolvedValueOnce({ modules: ['inventory'] })
    expect((await POST(req())).status).toBe(403)
    expect(mocks.rpc.mock.calls.some(([name]) => name === 'create_agenda_service')).toBe(false)
  })
  it('uses the server fallback quota on an expired subscription and maps busy writes', async () => {
    mocks.capacity.mockResolvedValue({ allowed: true, expired: true, limit: 3, blocked: false })
    mocks.rpc.mockImplementation(async (name: string) => name === 'create_agenda_service' ? { error: { code: '55P03' }, data: null } : { data: 'revision', error: null })
    const response = await POST(req())
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('SERVICE_BUSY')
    expect(mocks.rpc.mock.calls.find(([name]) => name === 'create_agenda_service')?.[1].p_limit).toBe(3)
  })
  it('permits a quota-full replay while denying a blocked subscription', async () => {
    mocks.capacity.mockResolvedValue({ allowed: false, limit: 1, blocked: false })
    mocks.rpc.mockImplementation(async (name: string) => ({ error: null, data: name === 'agenda_service_policy_revision' ? 'revision' : { id: 'existing', replayed: true } }))
    expect((await (await POST(req())).json()).replayed).toBe(true)
    mocks.capacity.mockResolvedValue({ allowed: false, blocked: true, limit: null })
    expect((await POST(req())).status).toBe(403)
  })
  it('reports missing SQL and stale policy without fallback or SQL leakage', async () => {
    mocks.rpc.mockResolvedValue({ error: { code: 'PGRST202', message: 'private SQL details' }, data: null })
    const response = await POST(req())
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain('private SQL')
    mocks.rpc.mockResolvedValueOnce({ data: 'old', error: null }).mockResolvedValueOnce({ data: 'new', error: null })
    expect((await POST(req())).status).toBe(409)
  })
})

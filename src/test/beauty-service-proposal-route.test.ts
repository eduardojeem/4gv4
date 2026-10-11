import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ auth: vi.fn(), org: vi.fn(), rpc: vi.fn(), plan: vi.fn(), publicAgenda: vi.fn() }))
vi.mock('@/lib/agenda/public-agenda-server', () => ({ resolvePublicAgenda: mocks.publicAgenda }))
vi.mock('@/lib/auth/request-auth', () => ({ resolveRequestAuthUser: mocks.auth }))
vi.mock('@/lib/saas/context', () => ({ getCurrentOrganizationContext: mocks.org }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => ({ rpc: mocks.rpc }) }))
vi.mock('@/lib/saas/subscription-service', () => ({ getOrganizationPlanInfo: mocks.plan }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
import { POST, PATCH } from '@/app/api/admin/website/service-proposal/route'

const options = { variant: 'studio', specialties: ['nails'], accentColor: '#826078', title: 'My studio', subtitle: '' }
const req = (body: unknown, method = 'POST') => new NextRequest('http://localhost/api/admin/website/service-proposal', { method, body: JSON.stringify(body) })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.publicAgenda.mockResolvedValue(null)
  mocks.auth.mockResolvedValue({ user: { id: 'actor' } })
  mocks.org.mockResolvedValue({ id: 'tenant', role: 'owner', slug: 'studio' })
  mocks.plan.mockResolvedValue({ businessVertical: 'beauty_services', operatingModel: 'service', effectiveModules: ['services'] })
  mocks.rpc.mockImplementation(async (name: string) => ({ error: null, data: name === 'service_website_proposal_snapshot' ? { organization: { id: 'tenant' }, settings: { services: [{ id: 'real', title: 'Manicura', price: 70000, active: true }] } } : name === 'service_website_proposal_revision' ? 'a'.repeat(32) : null }))
})
describe('service proposal tenant routes', () => {
  it('includes the real online agenda menu in previews instead of a false empty website menu', async () => {
    mocks.rpc.mockImplementation(async (name: string) => ({ error: null, data: name === 'service_website_proposal_snapshot' ? { organization: { id: 'tenant', slug: 'studio' }, settings: { services: [] } } : 'a'.repeat(32) }))
    mocks.publicAgenda.mockResolvedValue({ organization: { id: 'tenant' }, config: { currency: 'PYG', services: [{ product_id: 'actual', name: 'Manicura real', duration_minutes: 45, price: 75000, online: true }, { product_id: 'hidden', name: 'Privado', online: false }], professionals: [] } })
    const response = await POST(req(options))
    expect(response.status).toBe(200)
    expect((await response.json()).agenda.services).toEqual([{ id: 'actual', name: 'Manicura real', duration: 45, price: 75000 }])
  })
  it('previews real services without applying changes', async () => {
    const response = await POST(req(options))
    expect(response.status).toBe(200)
    expect((await response.json()).services[0].title).toBe('Manicura')
    expect(mocks.rpc.mock.calls.some(([name]) => name === 'apply_service_website_proposal')).toBe(false)
  })
  it('rejects cross-tenant injection rather than trusting a client organization', async () => {
    expect((await POST(req({ ...options, organizationId: 'someone-else' }))).status).toBe(422)
  })
  it('requires authentication and manage-settings permission', async () => {
    mocks.auth.mockResolvedValue({ reason: 'unauthenticated' })
    expect((await POST(req(options))).status).toBe(401)
    mocks.auth.mockResolvedValue({ user: { id: 'actor' } })
    mocks.org.mockResolvedValue({ id: 'tenant', role: 'cashier' })
    expect((await POST(req(options))).status).toBe(403)
  })
  it('rejects stale revisions without applying', async () => {
    const response = await PATCH(req({ ...options, revision: 'b'.repeat(32) }, 'PATCH'))
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('PROPOSAL_STALE')
  })
})

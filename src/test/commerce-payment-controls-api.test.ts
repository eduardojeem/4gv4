// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
vi.mock('@/lib/payments/control-history', () => ({ commerceControlHistory: async (methods: unknown[]) => methods }))
const state = vi.hoisted(() => ({ role: 'owner', organizationId: 'org-a', update: vi.fn(), read: vi.fn(), audit: vi.fn(), ready: vi.fn() }))
vi.mock('@/lib/api/withTenantAuth', () => ({ withTenantAuth: (_options: unknown, handler: (request: unknown, context: unknown) => Promise<Response>) => (request: unknown) => handler(request, { user: { id: 'actor' }, organization: { id: state.organizationId, role: state.role } }) }))
vi.mock('@/lib/payments/commerce-readiness', () => ({ commercePaymentControlsReady: vi.fn().mockResolvedValue(true), requireCommercePaymentControlsReady: state.ready }))
vi.mock('@/lib/payments/control-store', () => ({ readPaymentControlPolicy: state.read, updatePaymentControlPolicy: state.update }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => ({ from: () => ({ insert: state.audit }) }) }))
import { PaymentControlError } from '@/lib/payments/control-contract'
import { GET, PATCH } from '@/app/api/admin/payment-controls/route'
function request(body: unknown, org = 'org-a') { return new NextRequest('https://local.test/api/admin/payment-controls', { method: 'PATCH', headers: { origin: 'https://local.test', 'content-type': 'application/json', 'x-organization-id': org }, body: JSON.stringify(body) }) }
beforeEach(() => { state.ready.mockReset().mockResolvedValue(undefined); state.role = 'owner'; state.organizationId = 'org-a'; state.update.mockReset(); state.read.mockReset().mockResolvedValue({ revision: 'r1', flags: { cash: true } }); state.audit.mockReset().mockResolvedValue({ error: null }) })
describe('commerce payment configuration tenant boundary', () => {
  it('accepts the browser origin while the server listens on 0.0.0.0', async () => {
    const request = new NextRequest('http://0.0.0.0:3000/api/admin/payment-controls', { method: 'PATCH', headers: { host: 'localhost:3000', origin: 'http://localhost:3000', 'content-type': 'application/json', 'x-organization-id': 'org-a' }, body: JSON.stringify({ id: 'cash', enabled: false, revision: 'r1' }) })
    expect((await PATCH(request)).status).toBe(200)
  })
  it('allows staff to read availability without allowing a mutation', async () => {
    state.role = 'cashier'
    expect((await GET(new NextRequest('https://local.test/api/admin/payment-controls'))).status).toBe(200)
    expect((await PATCH(request({ id: 'cash', enabled: false, revision: 'r1' }))).status).toBe(403)
    expect(state.update).not.toHaveBeenCalled()
  })
  it('rejects a stale form after changing the active organization', async () => {
    state.organizationId = 'org-b'
    expect((await PATCH(request({ id: 'cash', enabled: false, revision: 'r1' }))).status).toBe(409)
    expect(state.update).not.toHaveBeenCalled()
  })
  it('rejects a body tenant override', async () => {
    expect((await PATCH(request({ id: 'cash', enabled: false, revision: 'r1', organizationId: 'org-b' }))).status).toBe(400)
    expect(state.update).not.toHaveBeenCalled()
  })
  it('requires database enforcement readiness before changing configuration', async () => {
    state.ready.mockRejectedValue(new PaymentControlError('Migración pendiente', 409, 'PAYMENT_CONTROLS_MIGRATION_REQUIRED'))
    const response = await PATCH(request({ id: 'cash', enabled: false, revision: 'r1' }))
    expect(response.status).toBe(409)
    expect(state.update).not.toHaveBeenCalled()
  })
  it('updates only the server resolved tenant and records an audit', async () => {
    const response = await PATCH(request({ id: 'cash', enabled: false, revision: 'r1' }))
    expect(response.status).toBe(200)
    expect(state.update).toHaveBeenCalledWith({ scope: 'commerce', actorId: 'actor', organizationId: 'org-a', id: 'cash', enabled: false, revision: 'r1' })
    expect(state.audit).toHaveBeenCalledOnce()
  })
})

// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/api/withTenantAuth', () => ({ withTenantAuth: (_: unknown, fn: (req: Request, context: unknown, route?: unknown) => Promise<Response>) => (req: Request, route: unknown) => fn(req, { organization: { id: 'org', role: 'admin' }, user: { id: 'actor' } }, route) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => ({ rpc: mocks.rpc }) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: mocks.from }) }))
import { PATCH } from './route'
import { POST } from '../route'
const id = 'a3000000-0000-4000-8000-000000000001'
const request = (body: unknown) => new NextRequest('http://localhost/api/after-sales/' + id, { method: 'PATCH', body: JSON.stringify(body) })
const call = (body: unknown) => PATCH(request(body), { params: Promise.resolve({ id }) })
beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: { data: { id, status: 'completed' }, refund: { method: 'cash', amount: 100 } }, error: null }) })
it('passes the actual actor and tenant to one atomic boundary without client side effects', async () => {
  const response = await call({ status: 'completed', refund_method: 'cash' })
  expect(response.status).toBe(200)
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('server_resolve_after_sales_case_atomic', { p_actor_user_id: 'actor', p_organization_id: 'org', p_case_id: id, p_input: { status: 'completed', refund_method: 'cash' } })
  expect(mocks.from).not.toHaveBeenCalled()
})
it('returns the persisted response on retry', async () => {
  const result = { data: { id, status: 'completed' }, replayed: true, refund: { method: 'cash', amount: 100 } }
  mocks.rpc.mockResolvedValue({ data: result, error: null })
  expect(await (await call({ status: 'completed', refund_method: 'cash' })).json()).toMatchObject({ success: true, ...result })
})
it.each([['AFTER_SALES_REFUND_EXCEEDS_CAP',400],['AFTER_SALES_REFUND_METHOD_REQUIRED',400],['AFTER_SALES_ALREADY_RESOLVED',409],['AFTER_SALES_FORBIDDEN',403],['AFTER_SALES_NOT_FOUND',404]])('maps %s without starting separate effects', async (message, status) => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message } })
  expect((await call({ status: 'completed' })).status).toBe(status)
  expect(mocks.from).not.toHaveBeenCalled()
})
it('does not fall back to unsafe writes when the migration is unavailable', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'function unavailable' } })
  expect((await call({ status: 'completed' })).status).toBe(503)
  expect(mocks.from).not.toHaveBeenCalled()
})
it('rejects invalid input before the database', async () => {
  expect((await call({ status: 'completed', refund_amount: -1 })).status).toBe(400)
  expect(mocks.rpc).not.toHaveBeenCalled()
})
it('creates through the atomic boundary with the actor and tenant', async () => {
  const input = { source_type: 'sale', request_type: 'return', sale_id: id, sale_item_id: id, quantity: 1, reason: 'Devolución' }
  const response = await POST(new NextRequest('http://localhost/api/after-sales', { method: 'POST', body: JSON.stringify(input) }))
  expect(response.status).toBe(201)
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('server_create_after_sales_case_atomic', { p_actor_user_id: 'actor', p_organization_id: 'org', p_input: input })
  expect(mocks.from).not.toHaveBeenCalled()
})
it('rejects invalid creation before the database', async () => {
  const response = await POST(new NextRequest('http://localhost/api/after-sales', { method: 'POST', body: JSON.stringify({ source_type: 'sale', request_type: 'return', reason: 'Devolución' }) }))
  expect(response.status).toBe(400)
  expect(mocks.rpc).not.toHaveBeenCalled()
})

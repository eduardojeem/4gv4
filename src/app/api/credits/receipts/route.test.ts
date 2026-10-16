// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ role: 'admin', payment: { data: { id: 'p' } as unknown, error: null as unknown }, collections: { data: [] as unknown[], error: null as unknown }, from: vi.fn() }))
vi.mock('@/lib/api/withTenantAuth', () => ({ withTenantAuth: (_guard: unknown, fn: (req: Request, context: { organization: { id: string; role: string } }) => Promise<Response>) => (req: Request) => fn(req, { organization: { id: 'org', role: mocks.role } }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => ({ from: mocks.from }) }))
import { GET } from './route'
const id = 'ca810000-0000-4000-8000-000000000001'
const request = () => new NextRequest('http://localhost/api/credits/receipts?paymentId=' + id)
beforeEach(() => {
  mocks.role = 'admin'; mocks.payment = { data: { id: 'p' }, error: null }; mocks.collections = { data: [], error: null }
  mocks.from.mockImplementation((_table: string) => {
    const query: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'contains']) query[method] = vi.fn(() => query)
    query.maybeSingle = vi.fn(async () => mocks.payment)
    query.limit = vi.fn(async () => mocks.collections)
    return query
  })
})
it('does not reveal whether another tenant owns a payment', async () => {
  mocks.payment.data = null
  expect((await GET(request())).status).toBe(404)
  expect(mocks.from).not.toHaveBeenCalledWith('customer_collection_requests')
})
it('denies customer roles even if the middleware context exists', async () => {
  mocks.role = 'customer'
  expect((await GET(request())).status).toBe(403)
})
it('marks old payments as historical instead of constructing an original receipt', async () => {
  const response = await GET(request())
  expect(await response.json()).toEqual({ success: true, legacy: true })
  expect(response.headers.get('Cache-Control')).toContain('no-store')
})
it('rejects ambiguous or corrupt persisted receipts', async () => {
  mocks.collections.data = [{ result: {} }, { result: {} }]
  expect((await GET(request())).status).toBe(409)
  mocks.collections.data = [{ result: {} }]
  expect((await GET(request())).status).toBe(409)
})
it('returns the complete original allocation instead of only the selected payment', async () => {
  const allocation = (paymentId: string) => ({ debtId: id, paymentId, type: 'installment', appliedAmount: 50, remainingBalance: 10 })
  const collection = { receiptId: id, receiptNumber: 'COL-ORIGINAL', recordedAt: '2026-10-15T12:00:00Z', appliedAmount: 100,
    excessToStoreCredit: 0, allocations: [allocation(id), allocation('ca810000-0000-4000-8000-000000000002')] }
  mocks.collections.data = [{ result: collection }]
  expect((await (await GET(request())).json()).collection).toEqual(collection)
})

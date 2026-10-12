// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({ auth: vi.fn(), organization: vi.fn(), plan: vi.fn(), admin: vi.fn(), rpc: vi.fn(),
  rows: {} as Record<string, unknown>, errors: {} as Record<string, unknown>, from: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/request-auth', () => ({ resolveRequestAuthUser: h.auth }))
vi.mock('@/lib/saas/context', () => ({ getCurrentOrganizationContext: h.organization }))
vi.mock('@/lib/saas/subscription-service', () => ({ getOrganizationPlanInfo: h.plan }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: h.admin }))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({ from: h.from })) }))
vi.mock('@/lib/customers/duplicate-check', () => ({ duplicatesMessage: vi.fn(), findCustomerDuplicates: vi.fn(async () => []) }))

import { GET, PUT } from '@/app/api/customers/[id]/credit-file/route'
import { POST as decision } from '@/app/api/customers/[id]/credit-file/decision/route'
import { GET as summary } from '@/app/api/customers/[id]/credit-file/summary/route'
import { PUT as policyUpdate } from '@/app/api/credits/file-policy/route'
import { validateGenericCreditLimitUpdate } from '@/lib/credits/credit-file-server'
import { PUT as customerUpdate } from '@/app/api/customers/route'
import { GET as documentDownload, PATCH as documentReview, DELETE as documentDelete } from '@/app/api/customers/[id]/credit-file/documents/[documentId]/route'

const actor = 'cf010000-0000-4000-8000-000000000001'
const org = 'cf110000-0000-4000-8000-000000000001'
const customer = 'cf210000-0000-4000-8000-000000000001'
const routeContext = { params: Promise.resolve({ id: customer }) }
const payload = { version: 0, identity: { type: 'ci', number: 'fixture' }, informedCustomer: true, references: [] }
function request(body?: unknown, path = `/api/customers/${customer}/credit-file`) {
  return new NextRequest(`http://localhost:3000${path}`, body === undefined ? {} : { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  vi.clearAllMocks()
  h.auth.mockResolvedValue({ user: { id: actor } })
  h.organization.mockResolvedValue({ id: org, role: 'owner', name: 'Fixture', slug: 'fixture', plan: 'pro', logoUrl: null })
  h.plan.mockResolvedValue({ modules: ['credits', 'crm'], entitledModules: ['credits', 'crm'], moduleTrials: [] })
  h.rows = { customers: { id: customer, credit_limit: 500 }, customer_credit_files: { status: 'pending', declared_monthly_income: 999, references: [{ phone: 'private-reference' }], object_path: 'private-path' }, organization_credit_file_policies: null, customer_credits: [], credit_installments: [] }
  h.errors = {}
  h.from.mockImplementation((table: string) => {
    const result = () => ({ data: h.rows[table] ?? null, error: h.errors[table] ?? null })
    const q = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), maybeSingle: vi.fn(), then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve) }
    q.select.mockReturnValue(q); q.eq.mockReturnValue(q); q.in.mockReturnValue(q); q.maybeSingle.mockImplementation(async () => result())
    return q
  })
  h.rpc.mockImplementation(async (name: string) => {
    if (name === 'customer_credit_file_missing') return { data: ['approval'], error: null }
    if (name === 'customer_credit_outstanding') return { data: 120, error: null }
    if (name === 'customer_credit_overdue_count') return { data: 0, error: null }
    return { data: { version: 1, status: 'draft', identity: { type: 'ci', number: 'fixture' }, documents: [], references: [], declaredMonthlyIncome: null }, error: null }
  })
  h.admin.mockReturnValue({ from: h.from, rpc: h.rpc })
})

describe('private customer credit file routes', () => {
  it.each(['download', 'review', 'delete'])('seller cannot use private document %s', async action => {
    h.organization.mockResolvedValue({ id: org, role: 'seller', name: 'Fixture', slug: 'fixture', plan: 'pro' })
    const documentContext = { params: Promise.resolve({ id: customer, documentId: 'cf440000-0000-4000-8000-000000000001' }) }
    const response = await ({ download: documentDownload, review: documentReview, delete: documentDelete }[action])(request({ version: 1 }), documentContext)
    expect(response.status).toBe(403)
    expect(h.admin).not.toHaveBeenCalled()
  })
  it('downloads only through a private attachment response', async () => {
    h.rows.customer_credit_documents = { id: 'cf440000-0000-4000-8000-000000000001', lifecycle: 'ready', object_path: 'never-public.jpg', filename: 'fixture.jpg', mime_type: 'image/jpeg', byte_size: 3 }
    h.admin.mockReturnValue({ from: h.from, rpc: h.rpc, storage: { from: () => ({ download: async () => ({ data: new Blob([new Uint8Array([255,216,255])]), error: null }) }) } })
    const response = await documentDownload(request(), { params: Promise.resolve({ id: customer, documentId: 'cf440000-0000-4000-8000-000000000001' }) })
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('content-disposition')).toContain('attachment;')
    expect(response.headers.get('content-disposition')).not.toContain('never-public')
  })
  it('requires an authenticated session before any privileged query', async () => {
    h.auth.mockResolvedValue({ reason: 'unauthenticated' })
    expect((await GET(request(), routeContext)).status).toBe(401)
    expect(h.admin).not.toHaveBeenCalled()
  })
  it.each(['GET', 'PUT', 'decision'])('seller cannot access private %s', async action => {
    h.organization.mockResolvedValue({ id: org, role: 'seller', name: 'Fixture', slug: 'fixture', plan: 'pro', logoUrl: null })
    const response = action === 'GET' ? await GET(request(), routeContext) : action === 'PUT' ? await PUT(request(payload), routeContext) : await decision(request({ version: 0, status: 'approved', limit: 500, reason: 'Review' }), routeContext)
    expect(response.status).toBe(403)
    expect(h.admin).not.toHaveBeenCalled()
  })
  it('rejects an unavailable credit module even for an owner', async () => {
    h.plan.mockResolvedValue({ modules: ['crm'], entitledModules: ['crm'], moduleTrials: [] })
    expect((await GET(request(), routeContext)).status).toBe(402)
    expect(h.admin).not.toHaveBeenCalled()
  })
  it('returns 404 for another organization customer before loading private data', async () => {
    h.rows.customers = null
    expect((await GET(request(), routeContext)).status).toBe(404)
    expect(h.rpc).not.toHaveBeenCalled()
    expect(h.from.mock.results[0].value.eq).toHaveBeenCalledWith('organization_id', org)
  })
  it('rejects invalid UUIDs before using the admin client', async () => {
    expect((await GET(request(), { params: Promise.resolve({ id: 'invalid' }) })).status).toBe(400)
    expect(h.admin).not.toHaveBeenCalled()
  })
  it('maps stale version to 409 without returning raw database details', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { code: '40001', message: 'private fixture detail' } })
    const response = await PUT(request(payload), routeContext)
    expect(response.status).toBe(409)
    expect(JSON.stringify(await response.json())).not.toContain('private fixture detail')
  })
  it('rejects actor/status/document injection without calling a write RPC', async () => {
    const response = await PUT(request({ ...payload, actorId: actor, status: 'approved', documents: [{ lifecycle: 'ready' }] }), routeContext)
    expect(response.status).toBe(400)
    expect(h.rpc).not.toHaveBeenCalled()
  })
  it('derives actor and organization in the server and sends expected version', async () => {
    const response = await PUT(request(payload), routeContext)
    expect(response.status).toBe(200)
    expect(h.rpc).toHaveBeenCalledWith('save_customer_credit_file', expect.objectContaining({ p_actor_id: actor, p_organization_id: org, p_customer_id: customer, p_expected_version: 0 }))
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })
  it('makes missing migration explicit instead of pretending the file is approved', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Missing RPC' } })
    const response = await GET(request(), routeContext)
    expect(response.status).toBe(503)
    expect((await response.json()).code).toBe('CREDIT_FILE_UNAVAILABLE')
  })
  it('returns only an operational summary to seller, never income, contacts or paths', async () => {
    h.organization.mockResolvedValue({ id: org, role: 'seller', name: 'Fixture', slug: 'fixture', plan: 'pro', logoUrl: null })
    const response = await summary(request(), routeContext)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.summary).toEqual({ status: 'pending', mode: 'informational', missing: ['approval'], limit: 500, outstanding: 120, available: 380, overdueCount: 0, eligible: false })
    expect(JSON.stringify(body)).not.toMatch(/private-reference|private-path|declaredMonthlyIncome|declared_monthly_income|references|documents/)
    expect(h.rpc.mock.calls.some(call => call[0] === 'customer_credit_file_dto')).toBe(false)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })
  it('allows policy changes only to owner/admin, not manager', async () => {
    h.organization.mockResolvedValue({ id: org, role: 'manager', name: 'Fixture', slug: 'fixture', plan: 'pro', logoUrl: null })
    expect((await policyUpdate(request({ version: 0, mode: 'required' }))).status).toBe(403)
    expect(h.admin).not.toHaveBeenCalled()
  })
  it('counts overdue installments without a truncated client-side history query', async () => {
    const previousRpc = h.rpc.getMockImplementation()!
    h.rpc.mockImplementation((name: string, ...args: unknown[]) => name === 'customer_credit_overdue_count' ? Promise.resolve({ data: 1201, error: null }) : previousRpc(name, ...args))
    const response = await summary(request(), routeContext)
    expect((await response.json()).summary.overdueCount).toBe(1201)
  })
  it('never exposes negative available credit after a limit reduction', async () => {
    const previousRpc = h.rpc.getMockImplementation()!
    h.rpc.mockImplementation((name: string, ...args: unknown[]) => name === 'customer_credit_outstanding' ? Promise.resolve({ data: 600, error: null }) : previousRpc(name, ...args))
    expect((await (await summary(request(), routeContext)).json()).summary.available).toBe(0)
  })
  it('prevents generic customer limit changes in required mode', async () => {
    h.rows.organization_credit_file_policies = { version: 0, mode: 'required', require_identity: false, min_verified_references: 0, required_documents: [] }
    await expect(validateGenericCreditLimitUpdate(org, customer, 600)).rejects.toMatchObject({ status: 409, code: 'CREDIT_LIMIT_REQUIRES_DECISION' })
  })
  it('protects the generic customer PUT API too, before any customer mutation', async () => {
    h.rows.organization_credit_file_policies = { version: 0, mode: 'required', require_identity: false, min_verified_references: 0, required_documents: [] }
    const response = await customerUpdate(request({ id: customer, credit_limit: 600 }, '/api/customers'))
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('CREDIT_LIMIT_REQUIRES_DECISION')
  })
  it('keeps unchanged limits and informational generic editing compatible', async () => {
    await expect(validateGenericCreditLimitUpdate(org, customer, 500)).resolves.toBeUndefined()
    await expect(validateGenericCreditLimitUpdate(org, customer, 600)).resolves.toBeUndefined()
  })
})

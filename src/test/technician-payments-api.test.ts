import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const org = '11111111-1111-4111-8111-111111111111'
const tech = '33333333-3333-4333-8333-333333333333'
const database = vi.hoisted(() => ({ reads: false, unassigned: false, paged: false }))
vi.mock('@/lib/technician/earnings-server', () => ({ computeTechnicianEarnings: async () => ({ earnings: { total: 100 }, compensation: {} }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => ({
  from: (table: string) => {
    if (!database.reads) throw new Error('Direct writes must not be used')
    const pagedRow = { status: 'pagado', amount: 1, branch_id: '44444444-4444-4444-8444-444444444444' }
    const data = database.paged ? table === 'technician_payments' ? Array.from({ length: 200 }, (_, index) => ({ ...pagedRow, id: String(index) })) : [] : table === 'technician_payments' ? [{ id: 'legacy', status: 'pagado', amount: 20, branch_id: null }] : database.unassigned ? [] : [
      { id: 'mapped', legacy_source_id: 'legacy', net_amount: 100, paid_amount: 20, branch_id: '44444444-4444-4444-8444-444444444444' },
      { id: 'payroll-only', legacy_source_id: null, net_amount: 80, paid_amount: 30, branch_id: '44444444-4444-4444-8444-444444444444' },
    ]
    const query = { select() { return this }, eq() { return this }, gte() { return this }, lte() { return this }, lt() { return this }, or() { return this }, order() { return this }, range: async (offset: number) => ({ data: database.paged && table === 'technician_payments' && offset > 0 ? [{ ...pagedRow, id: 'last' }] : data, error: null }),
      then(resolve: (value: unknown) => unknown) { return Promise.resolve(resolve({ data, error: null })) } }
    return query
  },
  rpc: async (name: string, args: { p_input: unknown }) => ({ data: name === 'server_save_technician_compensation' ? { compensation: args.p_input } : { id: 'payment', status: 'pagado' }, error: null }),
}) }))
vi.mock('@/lib/auth/require-auth', () => ({ requireStaff: async () => ({ authenticated: true, role: 'admin', user: { id: '22222222-2222-4222-8222-222222222222' } }), getAuthResponse: () => null }))
vi.mock('@/lib/saas/context', () => ({ getCurrentOrganizationContext: async () => ({ id: org }) }))
vi.mock('@/app/api/repairs/_lib', () => ({ resolveRepairModuleContext: async () => ({}), isNextResponse: () => false }))
vi.mock('@/lib/branches/server', () => ({ getRequestedBranchId: () => null, resolveBranchScopeForUser: async () => ({ branchId: '44444444-4444-4444-8444-444444444444' }) }))
const body = { period_from: '2026-10-01', period_to: '2026-10-31', amount: 100, method: 'efectivo' }
const request = (key?: string) => new NextRequest('http://localhost/api/repairs/technicians/'+tech+'/payments', {
  method: 'POST', headers: { 'content-type': 'application/json', ...(key ? { 'x-idempotency-key': key } : {}) }, body: JSON.stringify(body),
})
describe('technician compensation route', () => {
  const input = { base_salary: 100, commission_rate: 10, commission_base: 'labor', fixed_per_repair: 5, accrual_status: 'entregado', salary_effective_from: null }
  const put = (key?: string) => new NextRequest('http://localhost/api/repairs/technicians/'+tech+'/compensation', {
    method: 'PUT', headers: { 'content-type': 'application/json', ...(key ? { 'x-idempotency-key': key } : {}) }, body: JSON.stringify(input),
  })
  it('requires an idempotency key for condition changes', async () => {
    const { PUT } = await import('@/app/api/repairs/technicians/[id]/compensation/route')
    expect((await PUT(put(), { params: Promise.resolve({ id: tech }) })).status).toBe(400)
  })
  it('saves all components through one transaction', async () => {
    const { PUT } = await import('@/app/api/repairs/technicians/[id]/compensation/route')
    const response = await PUT(put('compensation-key'), { params: Promise.resolve({ id: tech }) })
    expect(response.status).toBe(200)
    expect((await response.json()).compensation.fixed_per_repair).toBe(5)
  })
})
describe('technician payment route', () => {
  it('counts disbursements beyond the first payment page', async () => {
    database.reads = true; database.paged = true
    try {
      const { GET } = await import('@/app/api/repairs/technicians/[id]/payments/route')
      const response = await GET(new NextRequest('http://localhost/api/payments?from=2026-10-01&to=2026-11-01'), { params: Promise.resolve({ id: tech }) })
      expect((await response.json()).summary.pagado).toBe(201)
    } finally { database.reads = false; database.paged = false }
  })
  it('keeps an unknown branch visible without counting it as branch-paid money', async () => {
    database.reads = true; database.unassigned = true
    try {
      const { GET } = await import('@/app/api/repairs/technicians/[id]/payments/route')
      const response = await GET(new NextRequest('http://localhost/api/payments?from=2026-10-01&to=2026-11-01'), { params: Promise.resolve({ id: tech }) })
      const data = await response.json()
      expect(data.payments).toHaveLength(1)
      expect(data.summary).toMatchObject({ pagado: 0, complete: false })
    } finally { database.reads = false; database.unassigned = false }
  })
  it('includes payroll-paid balances without counting imported payments twice', async () => {
    database.reads = true
    try {
      const { GET } = await import('@/app/api/repairs/technicians/[id]/payments/route')
      const response = await GET(new NextRequest('http://localhost/api/payments?from=2026-10-01&to=2026-11-01'), { params: Promise.resolve({ id: tech }) })
      expect(response.status).toBe(200)
      expect((await response.json()).summary).toMatchObject({ pagado: 50, devengado: 180, saldo: 130 })
    } finally { database.reads = false }
  })
  it('requires an idempotency key before writing', async () => {
    const { POST } = await import('@/app/api/repairs/technicians/[id]/payments/route')
    expect((await POST(request(), { params: Promise.resolve({ id: tech }) })).status).toBe(400)
  })
  it('records through the atomic RPC instead of direct writes', async () => {
    const { POST } = await import('@/app/api/repairs/technicians/[id]/payments/route')
    const response = await POST(request('payment-request-key'), { params: Promise.resolve({ id: tech }) })
    expect(response.status).toBe(201)
    expect((await response.json()).payment.id).toBe('payment')
  })
})

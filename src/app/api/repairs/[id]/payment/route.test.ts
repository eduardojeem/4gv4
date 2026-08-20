import { beforeEach, describe, expect, it, vi } from 'vitest'

const closeFinancial = vi.fn()
const registerUnpricedDeposit = vi.fn()
const fetchRepair = vi.fn()

function queryResult(result: { data: unknown; error: null }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    order: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
  }
  return query
}

const cashQuery = queryResult({ data: [{ id: 'cash-1', register_id: 'principal' }], error: null })
const repairRecord: {
  id: string
  ticket_number: string
  customer_id: string
  paid_amount: number
  payment_status: string
  final_cost: number | null
  estimated_cost: number
  pricing_mode: 'automatic' | 'budget' | 'manual'
  labor_cost: number
  discount_amount: number
  parts: Array<{ unit_price?: number | null; unit_cost?: number | null; quantity?: number | null }>
} = {
  id: 'repair-1', ticket_number: 'REP-1', customer_id: 'customer-1',
  paid_amount: 0, payment_status: 'pendiente', final_cost: 100_000, estimated_cost: 100_000,
  pricing_mode: 'automatic', labor_cost: 100_000, discount_amount: 0, parts: [],
}
const repairQuery = queryResult({ data: repairRecord, error: null })
const ctx = {
  supabase: {
    rpc: vi.fn(),
    from: vi.fn((table: string) => table === 'cash_closures' ? cashQuery : repairQuery),
  },
  userId: 'user-1', role: 'admin', organizationRole: 'admin',
  organizationId: 'org-1', branchId: 'branch-1',
}

vi.mock('@/app/api/repairs/_lib', () => ({
  resolveRepairRouteContext: vi.fn(async () => ctx),
  isNextResponse: vi.fn(() => false),
  fetchRepairById: (...args: unknown[]) => fetchRepair(...args),
}))
vi.mock('@/lib/repairs/financial-closure-rpc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/repairs/financial-closure-rpc')>()
  return { ...actual, closeRepairAndRegisterPayment: (...args: unknown[]) => closeFinancial(...args) }
})
vi.mock('@/lib/repairs/unpriced-deposit-rpc', () => ({
  registerUnpricedRepairDeposit: (...args: unknown[]) => registerUnpricedDeposit(...args),
}))
describe('POST /api/repairs/:id/payment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(repairRecord, {
      paid_amount: 0, final_cost: 100_000, estimated_cost: 100_000,
      pricing_mode: 'automatic', labor_cost: 100_000, discount_amount: 0, parts: [],
    })
    closeFinancial.mockResolvedValue({ payment_id: 'payment-1', idempotent: false })
    registerUnpricedDeposit.mockResolvedValue({ payment_id: 'deposit-1', idempotent: false })
    fetchRepair.mockResolvedValue({ data: { id: 'repair-1', payment_status: 'pagado' }, error: null })
  })

  it('rejects requests without an idempotency key', async () => {
    const { POST } = await import('./route')
    const request = { json: async () => ({ method: 'cash', amount: 100_000 }) } as never
    const response = await POST(request, { params: Promise.resolve({ id: 'repair-1' }) })
    expect(response.status).toBe(400)
    expect(closeFinancial).not.toHaveBeenCalled()
  })

  it('registers cash payment through the atomic financial operation', async () => {
    const { POST } = await import('./route')
    const request = { json: async () => ({
      method: 'cash', amount: 100_000, idempotencyKey: 'payment-123',
    }) } as never
    const response = await POST(request, { params: Promise.resolve({ id: 'repair-1' }) })

    expect(response.status).toBe(200)
    expect(closeFinancial).toHaveBeenCalledWith(ctx.supabase, expect.objectContaining({
      repairId: 'repair-1', deliver: false, cashSessionId: 'cash-1',
      payment: expect.objectContaining({ idempotencyKey: 'payment-123' }),
    }))
  })

  it('returns the authoritative balance before an oversized payment reaches the RPC', async () => {
    const { POST } = await import('./route')
    const request = { json: async () => ({
      method: 'cash', amount: 120_000, idempotencyKey: 'payment-oversized',
    }) } as never
    const response = await POST(request, { params: Promise.resolve({ id: 'repair-1' }) })
    const payload = await response.json()

    expect(response.status).toBe(422)
    expect(payload).toMatchObject({
      code: 'REPAIR_PAYMENT_EXCEEDS_BALANCE',
      currentTotal: 100_000,
      currentPaid: 0,
      currentBalance: 100_000,
    })
    expect(closeFinancial).not.toHaveBeenCalled()
  })

  it('reports a zero authoritative balance as an already settled repair', async () => {
    repairRecord.labor_cost = 0
    repairRecord.final_cost = 0
    repairRecord.estimated_cost = 0
    const { POST } = await import('./route')
    const request = { json: async () => ({
      method: 'cash', amount: 10_000, idempotencyKey: 'payment-no-balance',
    }) } as never
    const response = await POST(request, { params: Promise.resolve({ id: 'repair-1' }) })
    const payload = await response.json()

    expect(response.status).toBe(422)
    expect(payload).toMatchObject({ code: 'REPAIR_HAS_NO_BALANCE', currentBalance: 0 })
    expect(closeFinancial).not.toHaveBeenCalled()
  })

  it('registers an explicit deposit when the repair price is still unknown', async () => {
    repairRecord.labor_cost = 0
    repairRecord.final_cost = null
    repairRecord.estimated_cost = 0
    const { POST } = await import('./route')
    const request = { json: async () => ({
      purpose: 'deposit', method: 'cash', amount: 50_000, idempotencyKey: 'deposit-unpriced-1',
    }) } as never
    const response = await POST(request, { params: Promise.resolve({ id: 'repair-1' }) })

    expect(response.status).toBe(200)
    expect(registerUnpricedDeposit).toHaveBeenCalledWith(ctx.supabase, expect.objectContaining({
      repairId: 'repair-1', amount: 50_000, cashSessionId: 'cash-1',
    }))
    expect(closeFinancial).not.toHaveBeenCalled()
  })

  it('collects a historical estimated price when automatic details were never persisted', async () => {
    repairRecord.labor_cost = 0
    repairRecord.final_cost = null
    repairRecord.estimated_cost = 600_000
    repairRecord.parts = []
    const { POST } = await import('./route')
    const request = { json: async () => ({
      method: 'cash', amount: 600_000, idempotencyKey: 'payment-legacy-price',
    }) } as never
    const response = await POST(request, { params: Promise.resolve({ id: 'repair-1' }) })

    expect(response.status).toBe(200)
    expect(closeFinancial).toHaveBeenCalledWith(ctx.supabase, expect.objectContaining({
      repairId: 'repair-1',
      payment: expect.objectContaining({ amount: 600_000 }),
    }))
  })

  it('delegates repair credit creation to the atomic financial operation', async () => {
    closeFinancial.mockResolvedValue({
      payment_id: 'payment-1', credit_id: 'atomic-credit', credit_total: 112_000,
      idempotent: false,
    })
    const { POST } = await import('./route')
    const request = { json: async () => ({
      method: 'credit', amount: 100_000, interestRate: 12,
      installments: { count: 6, frequency: 'monthly' },
      idempotencyKey: 'credit-payment-123',
    }) } as never
    const response = await POST(request, { params: Promise.resolve({ id: 'repair-1' }) })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(closeFinancial).toHaveBeenCalledWith(ctx.supabase, expect.objectContaining({
      creditId: null,
      payment: expect.objectContaining({
        method: 'credit', interestRate: 12,
        installments: { count: 6, frequency: 'monthly' },
      }),
    }))
    expect(payload.credit).toEqual({ creditId: 'atomic-credit', financedTotal: 112_000 })
  })

  it.each(['card', 'transfer'] as const)('rejects %s without a reference', async (method) => {
    const { POST } = await import('./route')
    const request = { json: async () => ({
      method, amount: 100_000, idempotencyKey: `payment-${method}`,
    }) } as never
    const response = await POST(request, { params: Promise.resolve({ id: 'repair-1' }) })

    expect(response.status).toBe(400)
    expect(closeFinancial).not.toHaveBeenCalled()
  })
})

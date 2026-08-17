import { beforeEach, describe, expect, it, vi } from 'vitest'

const closeFinancial = vi.fn()
const closeUnrepaired = vi.fn()
const fetchRepair = vi.fn()
const ctx = {
  supabase: { rpc: vi.fn() },
  userId: 'user-1',
  role: 'admin',
  organizationRole: 'admin',
  organizationId: 'org-1',
  branchId: 'branch-1',
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
vi.mock('@/lib/repairs/unrepaired-closeout-rpc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/repairs/unrepaired-closeout-rpc')>()
  return { ...actual, closeUnrepairedRepair: (...args: unknown[]) => closeUnrepaired(...args) }
})

describe('POST /api/repairs/:id/delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    closeFinancial.mockResolvedValue({ payment_id: null, idempotent: false })
    closeUnrepaired.mockResolvedValue({ closeout_id: 'closeout-1', payment_id: null, idempotent: false })
    fetchRepair.mockResolvedValue({ data: { id: 'repair-1', status: 'entregado' }, error: null })
  })

  it('requires explicit outstanding balance consent', async () => {
    const { POST } = await import('./route')
    const request = { json: async () => ({ outcome: 'repaired', idempotencyKey: 'delivery-123' }) } as never
    const response = await POST(request, { params: Promise.resolve({ id: 'repair-1' }) })
    expect(response.status).toBe(400)
    expect(closeFinancial).not.toHaveBeenCalled()
  })

  it('uses the atomic financial closure operation', async () => {
    const { POST } = await import('./route')
    const request = { json: async () => ({
      outcome: 'repaired',
      allowOutstandingBalance: true,
      idempotencyKey: 'delivery-123',
    }) } as never
    const response = await POST(request, { params: Promise.resolve({ id: 'repair-1' }) })

    expect(response.status).toBe(200)
    expect(closeFinancial).toHaveBeenCalledWith(ctx.supabase, expect.objectContaining({
      repairId: 'repair-1', organizationId: 'org-1', branchId: 'branch-1',
      actorId: 'user-1', deliver: true, allowOutstandingBalance: true,
      idempotencyKey: 'delivery-123',
    }))
  })

  it('supports credit payment upon delivery without requiring cash session', async () => {
    const { POST } = await import('./route')
    const request = { json: async () => ({
      outcome: 'repaired',
      allowOutstandingBalance: false,
      idempotencyKey: 'delivery-credit-123',
      payment: {
        method: 'credit',
        amount: 250_000,
        interestRate: 10,
        installments: { count: 3, frequency: 'monthly' },
        idempotencyKey: 'credit-pay-123',
      },
    }) } as never

    const response = await POST(request, { params: Promise.resolve({ id: 'repair-1' }) })

    expect(response.status).toBe(200)
    expect(closeFinancial).toHaveBeenCalledWith(ctx.supabase, expect.objectContaining({
      repairId: 'repair-1',
      organizationId: 'org-1',
      branchId: 'branch-1',
      actorId: 'user-1',
      deliver: true,
      cashSessionId: null,
      payment: expect.objectContaining({
        method: 'credit',
        amount: 250_000,
        interestRate: 10,
      }),
    }))
  })
})

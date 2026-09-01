import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
const fetchRepair = vi.fn()
const routeContext = { supabase: { rpc }, userId: 'user-1', role: 'admin', organizationRole: 'admin', organizationId: 'org-1', branchId: 'branch-1' }

vi.mock('@/app/api/repairs/_lib', () => ({
  resolveRepairRouteContext: vi.fn(async () => routeContext), isNextResponse: vi.fn(() => false),
  fetchRepairById: (...args: unknown[]) => fetchRepair(...args),
}))

describe('POST /api/repairs/:id/costs/final-correction', () => {
  beforeEach(() => {
    vi.clearAllMocks(); routeContext.organizationRole = 'admin'
    rpc.mockResolvedValue({ data: { previousFinalTotal: 200_000, newFinalTotal: 250_000, balance: 50_000 }, error: null })
    fetchRepair.mockResolvedValue({ data: { id: 'repair-1', final_cost: 250_000, paid_amount: 200_000 }, error: null })
  })

  it('sends only the corrected total, reason and tenant scope', async () => {
    const { POST } = await import('./route')
    const response = await POST({ json: async () => ({ newFinalTotal: 250_000, reason: 'Precio final digitado incorrectamente', idempotencyKey: 'final-fix-123', paidAmount: 0 }) } as never, { params: Promise.resolve({ id: 'repair-1' }) })
    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('correct_delivered_repair_final_price', {
      p_repair_id: 'repair-1', p_organization_id: 'org-1', p_branch_id: 'branch-1', p_actor_id: 'user-1',
      p_new_final_total: 250_000, p_reason: 'Precio final digitado incorrectamente', p_idempotency_key: 'final-fix-123',
    })
  })

  it('maps an overpayment rejection without changing the repair', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'REPAIR_FINAL_PRICE_BELOW_PAID|50000' } })
    const { POST } = await import('./route')
    const response = await POST({ json: async () => ({ newFinalTotal: 150_000, reason: 'Precio final digitado incorrectamente', idempotencyKey: 'final-fix-123' }) } as never, { params: Promise.resolve({ id: 'repair-1' }) })
    const body = await response.json()
    expect(response.status).toBe(409)
    expect(body).toMatchObject({ code: 'REPAIR_FINAL_PRICE_BELOW_PAID', overpaymentAmount: 50_000 })
    expect(fetchRepair).not.toHaveBeenCalled()
  })
})

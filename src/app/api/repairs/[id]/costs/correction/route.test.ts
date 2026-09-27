import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
const fetchRepair = vi.fn()
const routeContext = {
  supabase: { rpc }, userId: 'user-1', role: 'admin', organizationRole: 'admin',
  organizationId: 'org-1', branchId: 'branch-1',
}

vi.mock('@/app/api/repairs/_lib', () => ({
  resolveRepairRouteContext: vi.fn(async () => routeContext),
  isNextResponse: vi.fn(() => false),
  fetchRepairById: (...args: unknown[]) => fetchRepair(...args),
}))

describe('POST /api/repairs/:id/costs/correction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routeContext.organizationRole = 'admin'
    rpc.mockResolvedValue({ data: { revisionId: 'revision-2', previousInternalCost: 95, newInternalCost: 95_000 }, error: null })
    fetchRepair.mockResolvedValue({ data: { id: 'repair-1', status: 'entregado', final_cost: 200_000 }, error: null })
  })

  it('sends only internal part costs, reason and tenant scope to the RPC', async () => {
    const { POST } = await import('./route')
    const request = { json: async () => ({
      corrections: [{ partId: '11111111-1111-4111-8111-111111111111', unitCost: 95_000 }],
      reason: 'Error de digitación: faltaron tres ceros', idempotencyKey: 'correction-123',
      finalCost: 1, paidAmount: 0,
    }) } as never

    const response = await POST(request, { params: Promise.resolve({ id: 'repair-1' }) })

    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('correct_delivered_repair_internal_cost', {
      p_repair_id: 'repair-1', p_organization_id: 'org-1', p_branch_id: 'branch-1', p_actor_id: 'user-1',
      p_corrections: [{ part_id: '11111111-1111-4111-8111-111111111111', unit_cost: 95_000 }],
      p_reason: 'Error de digitación: faltaron tres ceros', p_idempotency_key: 'correction-123',
    })
    expect(fetchRepair).toHaveBeenCalled()
  })

  it('rejects non-admin organization roles', async () => {
    routeContext.organizationRole = 'technician' as never
    const { POST } = await import('./route')
    const response = await POST({ json: async () => ({}) } as never, { params: Promise.resolve({ id: 'repair-1' }) })
    expect(response.status).toBe(403)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('requires a meaningful reason and valid correction rows', async () => {
    const { POST } = await import('./route')
    const response = await POST({ json: async () => ({
      corrections: [{ partId: 'bad', unitCost: -1 }], reason: 'error', idempotencyKey: 'short',
    }) } as never, { params: Promise.resolve({ id: 'repair-1' }) })
    expect(response.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const saveRevision = vi.fn()
const fetchRepair = vi.fn()
const ctx = {
  supabase: { from: vi.fn(), rpc: vi.fn() },
  userId: 'user-1', role: 'admin', organizationRole: 'admin',
  organizationId: 'org-1', branchId: 'branch-1',
}

vi.mock('@/app/api/repairs/_lib', () => ({
  resolveRepairRouteContext: vi.fn(async () => ctx),
  isNextResponse: vi.fn(() => false),
  fetchRepairById: (...args: unknown[]) => fetchRepair(...args),
}))
vi.mock('@/lib/repairs/save-cost-revision', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/repairs/save-cost-revision')>()
  return { ...actual, saveRepairCostRevision: (...args: unknown[]) => saveRevision(...args) }
})

describe('POST /api/repairs/:id/costs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    saveRevision.mockResolvedValue({ revisionId: 'revision-1', summary: { finalTotal: 300_000 }, parts: [] })
    fetchRepair.mockResolvedValue({ data: { id: 'repair-1', final_cost: 300_000 }, error: null })
  })

  it('sends intent but ignores a browser supplied total', async () => {
    const { POST } = await import('./route')
    const request = { json: async () => ({
      laborAmount: 100_000, parts: [], additionalCharges: 0, deductions: 0,
      discountAmount: 0, idempotencyKey: 'cost-edit-1', finalTotal: 1,
    }) } as never

    const response = await POST(request, { params: Promise.resolve({ id: 'repair-1' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(saveRevision).toHaveBeenCalledWith(ctx.supabase, expect.objectContaining({
      repairId: 'repair-1', organizationId: 'org-1', branchId: 'branch-1', actorId: 'user-1',
    }), expect.not.objectContaining({ finalTotal: expect.anything() }))
    expect(body.repair.final_cost).toBe(300_000)
  })

  it('rejects malformed parts before calling the RPC', async () => {
    const { POST } = await import('./route')
    const request = { json: async () => ({ laborAmount: 1, parts: [{ quantity: 0 }] }) } as never
    const response = await POST(request, { params: Promise.resolve({ id: 'repair-1' }) })

    expect(response.status).toBe(400)
    expect(saveRevision).not.toHaveBeenCalled()
  })
})

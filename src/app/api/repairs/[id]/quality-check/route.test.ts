import { beforeEach, describe, expect, it, vi } from 'vitest'

const resolveContext = vi.fn()
const recordQualityCheck = vi.fn()
const fetchRepair = vi.fn()
const ctx = {
  supabase: { rpc: vi.fn() }, userId: 'tech-1', role: 'tecnico',
  organizationRole: 'technician', organizationId: 'org-1', branchId: 'branch-1',
}

vi.mock('@/app/api/repairs/_lib', () => ({
  resolveRepairRouteContext: (...args: unknown[]) => resolveContext(...args),
  isNextResponse: vi.fn(() => false),
  fetchRepairById: (...args: unknown[]) => fetchRepair(...args),
}))
vi.mock('@/lib/repairs/quality-check-rpc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/repairs/quality-check-rpc')>()
  return { ...actual, recordRepairQualityCheck: (...args: unknown[]) => recordQualityCheck(...args) }
})

describe('POST /api/repairs/:id/quality-check', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveContext.mockResolvedValue(ctx)
    recordQualityCheck.mockResolvedValue({ quality_check_id: 'quality-1', result: 'passed', status: 'listo' })
    fetchRepair.mockResolvedValue({ data: { id: 'repair-1', status: 'listo' }, error: null })
  })

  it('records a tenant-scoped technical check and returns the updated repair', async () => {
    const { POST } = await import('./route')
    const request = { json: async () => ({
      result: 'passed',
      checklist: {
        powersOn: true, reportedIssueResolved: true, basicFunctions: true,
        physicalCondition: true, accessoriesVerified: true,
      },
    }) } as never

    const response = await POST(request, { params: Promise.resolve({ id: 'repair-1' }) })

    expect(response.status).toBe(200)
    expect(resolveContext).toHaveBeenCalledWith(request, 'repairs.orders.update')
    expect(recordQualityCheck).toHaveBeenCalledWith(ctx.supabase, expect.objectContaining({
      repairId: 'repair-1', organizationId: 'org-1', branchId: 'branch-1', actorId: 'tech-1',
    }))
  })

  it('rejects a cashier attempting to change the technical result', async () => {
    resolveContext.mockResolvedValue({ ...ctx, organizationRole: 'cashier' })
    const { POST } = await import('./route')
    const request = { json: async () => ({ result: 'failed', checklist: {}, note: 'No enciende.' }) } as never

    const response = await POST(request, { params: Promise.resolve({ id: 'repair-1' }) })

    expect(response.status).toBe(403)
    expect(recordQualityCheck).not.toHaveBeenCalled()
  })
})

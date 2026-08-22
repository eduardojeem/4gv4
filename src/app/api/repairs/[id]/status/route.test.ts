import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/require-auth', () => ({
  requireStaff: vi.fn(async () => ({ authenticated: true, user: { id: 'user-1' }, role: 'admin' })),
  getAuthResponse: vi.fn(() => null),
}))
vi.mock('@/lib/saas/context', () => ({
  getCurrentOrganizationContext: vi.fn(async () => ({ id: 'org-1', role: 'admin' })),
}))
vi.mock('@/lib/saas/permissions', () => ({ roleHasPermission: vi.fn(() => true) }))

describe('PATCH /api/repairs/:id/status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects delivery through the generic status endpoint', async () => {
    const { PATCH } = await import('./route')
    const request = { json: async () => ({ stage: 'entregado' }) } as never
    const response = await PATCH(request, { params: Promise.resolve({ id: 'repair-1' }) })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      ok: false,
      code: 'USE_DELIVERY_ENDPOINT',
    })
  })
})

import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/auth/require-auth', () => ({
  requireStaff: vi.fn(async () => ({
    authenticated: true,
    user: { id: 'test-user' },
    role: 'admin',
  })),
  getAuthResponse: vi.fn(() => null),
}))

vi.mock('@/lib/saas/context', () => ({
  getCurrentOrganizationContext: vi.fn(async () => null),
}))

describe('GET /api/repairs', () => {
  it('returns a structured error when active organization is missing', async () => {
    const { GET } = await import('./route')
    const res = await GET({ headers: new Headers() } as Request)
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.code).toBe('ACTIVE_ORGANIZATION_REQUIRED')
  })
})

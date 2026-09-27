import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getCurrentOrganizationContext: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
  })),
}))

vi.mock('@/lib/saas/context', () => ({
  getCurrentOrganizationContext: mocks.getCurrentOrganizationContext,
}))

describe('GET /api/organization-context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-a' } },
      error: null,
    })
    mocks.getCurrentOrganizationContext.mockResolvedValue({
      id: 'org-a',
      name: 'Organización A',
      slug: 'organizacion-a',
      plan: 'pro',
      logoUrl: null,
      role: 'owner',
    })
  })

  it('returns only the server-resolved active organization', async () => {
    const { GET } = await import('./route')
    const response = await GET(
      new Request('http://localhost/api/organization-context?organizationId=org-b'),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      activeOrganization: {
        id: 'org-a',
        name: 'Organización A',
        slug: 'organizacion-a',
        role: 'owner',
      },
    })
    expect(mocks.getCurrentOrganizationContext).toHaveBeenCalledWith('user-a')
  })

  it('rejects an unauthenticated request', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    const { GET } = await import('./route')
    const response = await GET(new Request('http://localhost/api/organization-context'))

    expect(response.status).toBe(401)
    expect(mocks.getCurrentOrganizationContext).not.toHaveBeenCalled()
  })

  it('rejects users without an active staff organization', async () => {
    mocks.getCurrentOrganizationContext.mockResolvedValue(null)
    const { GET } = await import('./route')
    const response = await GET(new Request('http://localhost/api/organization-context'))

    expect(response.status).toBe(403)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  organization: vi.fn(),
  members: [] as { organization_id: string }[] | null,
  error: null as unknown,
  eq: vi.fn(),
}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: mocks.auth,
  getAuthResponse: (auth: { authenticated: boolean; response?: NextResponse }) =>
    auth.authenticated ? null : auth.response,
}))
vi.mock('@/lib/saas/context', () => ({ getCurrentOrganizationContext: mocks.organization }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({
    from: () => {
      const builder = {
        select: () => builder,
        eq: (...args: unknown[]) => {
          mocks.eq(...args)
          return builder
        },
        neq: () => builder,
        limit: async () => ({ data: mocks.members, error: mocks.error }),
      }
      return builder
    },
  }),
}))
import { GET } from './route'
beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ authenticated: true, user: { id: 'user-a' } })
  mocks.organization.mockResolvedValue({
    id: 'org-a',
    name: 'Organización A',
    slug: 'organizacion-a',
    role: 'owner',
  })
  mocks.members = []
  mocks.error = null
})
describe('contexto de negocio web y móvil', () => {
  it('usa el usuario y la empresa resueltos por el servidor, nunca un id de query', async () => {
    const response = await GET(new Request('https://fixture.test?organizationId=ajena'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      activeOrganization: {
        id: 'org-a',
        name: 'Organización A',
        slug: 'organizacion-a',
        role: 'owner',
      },
    })
    expect(mocks.organization).toHaveBeenCalledWith('user-a')
    expect(response.headers.get('cache-control')).toContain('no-store')
  })
  it.each([401, 403])(
    'conserva el rechazo de autenticación o cuenta inactiva (%s)',
    async (status) => {
      mocks.auth.mockResolvedValue({
        authenticated: false,
        response: NextResponse.json({ error: 'Sin acceso' }, { status }),
      })
      expect((await GET()).status).toBe(status)
      expect(mocks.organization).not.toHaveBeenCalled()
    },
  )
  it('solo confirma ausencia si no hay membresía staff activa', async () => {
    mocks.organization.mockResolvedValue(null)
    const response = await GET()
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: 'NO_ACTIVE_BUSINESS_MEMBERSHIP' })
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'user-a')
    expect(mocks.eq).toHaveBeenCalledWith('status', 'active')
  })
  it('no confunde una selección no resuelta con no tener negocio', async () => {
    mocks.organization.mockResolvedValue(null)
    mocks.members = [{ organization_id: 'org-a' }]
    const response = await GET()
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'ACTIVE_ORGANIZATION_UNAVAILABLE' })
  })
  it('un fallo de base mantiene acceso desconocido', async () => {
    mocks.organization.mockResolvedValue(null)
    mocks.error = { message: 'offline' }
    expect((await GET()).status).toBe(503)
  })
})

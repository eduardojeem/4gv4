// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), read: vi.fn(), admin: vi.fn() }))
vi.mock('@/lib/api/withTenantAuth', () => ({
  withTenantAuth:
    (
      _options: unknown,
      handler: (
        request: NextRequest,
        context: { organization: { id: string } },
        route: unknown,
      ) => Promise<Response>,
    ) =>
    (request: NextRequest, route: unknown) =>
      handler(request, { organization: { id: 'active-org' } }, route),
}))
vi.mock('@/lib/supabase/org-scoped-server', () => ({
  createOrgScopedClient: async () => ({
    rpc: mocks.rpc,
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mocks.read }) }) }) }),
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: mocks.admin }))
import { POST } from '@/app/api/raffles/[id]/draw/route'
beforeEach(() => {
  vi.clearAllMocks()
  mocks.read.mockResolvedValue({ data: { id: 'raffle', status: 'closed' }, error: null })
  mocks.rpc.mockResolvedValue({ data: [], error: null })
})
const draw = (body: unknown = {}) =>
  POST(
    new NextRequest('http://localhost/api/raffles/raffle/draw', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: 'raffle' }) },
  )
it('no sortea un identificador fuera de la organización activa', async () => {
  mocks.read.mockResolvedValue({ data: null, error: null })
  expect((await draw()).status).toBe(404)
  expect(mocks.rpc).not.toHaveBeenCalled()
})
it('un rechazo de permisos nunca cambia a un cliente administrador', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } })
  expect((await draw()).status).toBeGreaterThanOrEqual(400)
  expect(mocks.admin).not.toHaveBeenCalled()
})
it('rechaza una semilla inválida antes de ejecutar el sorteo', async () => {
  expect((await draw({ seed: 'x'.repeat(201) })).status).toBe(400)
  expect(mocks.rpc).not.toHaveBeenCalled()
})

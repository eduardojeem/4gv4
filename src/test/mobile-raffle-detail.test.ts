// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  ticketsError: false,
  count: 60,
  range: vi.fn(),
  org: vi.fn(),
  winnersError: false,
}))
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
      handler(request, { organization: { id: 'org-one' } }, route),
}))
vi.mock('@/lib/supabase/org-scoped-server', () => ({
  createOrgScopedClient: async () => ({
    from: (table: string) => {
      const result = () =>
        table === 'raffles'
          ? { data: { id: 'raffle-one' }, error: null }
          : table === 'raffle_tickets'
            ? {
                data: [{ id: 'ticket' }],
                count: mocks.count,
                error: mocks.ticketsError ? { message: 'denied' } : null,
              }
            : { data: [], error: mocks.winnersError ? { message: 'denied' } : null }
      const chain = {
        select: () => chain,
        eq: (_field: string, value: string) => {
          if (_field === 'organization_id') mocks.org(value)
          return chain
        },
        order: () => chain,
        maybeSingle: async () => result(),
        range: (start: number, end: number) => {
          mocks.range(start, end)
          return chain
        },
        then: (done: (value: ReturnType<typeof result>) => unknown) =>
          Promise.resolve(result()).then(done),
      }
      return chain
    },
  }),
}))
import { GET } from '@/app/api/raffles/[id]/route'
beforeEach(() => {
  vi.clearAllMocks()
  mocks.ticketsError = false
  mocks.winnersError = false
  mocks.count = 60
})
const load = (query = '') =>
  GET(new NextRequest('http://localhost/api/raffles/raffle-one' + query), {
    params: Promise.resolve({ id: 'raffle-one' }),
  })
it('pagina participantes y filtra todas las tablas por la organización activa', async () => {
  const response = await load('?page=2&limit=25')
  expect(response.status).toBe(200)
  expect(mocks.range).toHaveBeenCalledWith(25, 49)
  expect(mocks.org.mock.calls.map((args) => args[0])).toEqual(['org-one', 'org-one', 'org-one'])
  expect((await response.json()).ticketsPagination).toMatchObject({ page: 2, total: 60, pages: 3 })
})
it('conserva el detalle web sin paginación obligatoria', async () => {
  expect((await load()).status).toBe(200)
  expect(mocks.range).not.toHaveBeenCalled()
})
it('no presenta un fallo de participantes o ganadores como una lista vacía', async () => {
  mocks.winnersError = true
  expect((await load('?page=1')).status).toBe(500)
  mocks.winnersError = false
  mocks.ticketsError = true
  expect((await load('?page=1')).status).toBe(500)
})
it('rechaza una página inválida antes de consultar', async () => {
  expect((await load('?page=-1')).status).toBe(400)
  expect(mocks.range).not.toHaveBeenCalled()
})

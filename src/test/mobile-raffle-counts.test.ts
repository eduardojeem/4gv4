// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ total: 2, error: false }))
vi.mock('@/lib/api/withTenantAuth', () => ({
  withTenantAuth:
    (
      _options: unknown,
      handler: (
        request: NextRequest,
        context: { organization: { id: string } },
      ) => Promise<Response>,
    ) =>
    (request: NextRequest) =>
      handler(request, { organization: { id: 'org-one' } }),
}))
vi.mock('@/lib/supabase/org-scoped-server', () => ({
  createOrgScopedClient: async () => ({
    from: (table: string) => {
      const result = () =>
        table === 'raffles'
          ? { data: [{ id: 'raffle-one' }], error: null }
          : {
              data: [
                { raffle_id: 'raffle-one', customer_id: 'one' },
                { raffle_id: 'raffle-one', customer_id: 'two' },
              ],
              count: state.total,
              error: state.error ? { message: 'denied' } : null,
            }
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        then: (done: (value: ReturnType<typeof result>) => unknown) =>
          Promise.resolve(result()).then(done),
      }
      return chain
    },
  }),
}))
import { GET } from '@/app/api/raffles/route'
beforeEach(() => {
  state.total = 2
  state.error = false
})
const load = () => GET(new NextRequest('http://localhost/api/raffles'), {} as never)
it('muestra clientes únicos cuando recibió la participación completa', async () => {
  expect((await (await load()).json()).raffles[0].participants_count).toBe(2)
})
it('no inventa un total cuando PostgREST truncó los números', async () => {
  state.total = 2000
  expect((await (await load()).json()).raffles[0].participants_count).toBeNull()
})
it('no convierte un error de participación en cero participantes', async () => {
  state.error = true
  expect((await load()).status).toBe(500)
})

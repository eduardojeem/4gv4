// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({
  user: 'user-one',
  reason: null as string | null,
  rows: [] as Record<string, unknown>[],
  error: null as { code: string } | null,
  filters: [] as unknown[][],
  price: 45000,
}))
vi.mock('@/lib/auth/request-auth', () => ({
  resolveRequestAuthUser: async () =>
    state.reason
      ? { authenticated: false, reason: state.reason }
      : { authenticated: true, user: { id: state.user } },
}))
vi.mock('@/lib/agenda/public-appointment-price', () => ({
  publicAppointmentPrice: async () => state.price,
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({
    from: (table: string) => {
      const filters: Array<[string, unknown]> = []
      let single = false
      const result = () => {
        if (table === 'organizations')
          return {
            data: [{ id: 'org-one', name: 'Barbería Uno', slug: 'barberia-uno' }],
            error: null,
          }
        if (table === 'organization_settings')
          return {
            data: [{ organization_id: 'org-one', timezone: 'America/Asuncion', currency: 'PYG' }],
            error: null,
          }
        const rows = state.rows.filter((row) =>
          filters.every(([key, value]) =>
            key === 'customer.profile_id'
              ? (row.customer as { profile_id: string }).profile_id === value
              : row[key] === value,
          ),
        )
        return { data: single ? (rows[0] ?? null) : rows, error: state.error }
      }
      const chain = {
        select: () => chain,
        eq: (key: string, value: unknown) => {
          filters.push([key, value])
          state.filters.push([key, value])
          return chain
        },
        in: () => chain,
        gt: () => chain,
        or: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: () => {
          single = true
          return Promise.resolve(result())
        },
        then: (done: (value: ReturnType<typeof result>) => unknown) =>
          Promise.resolve(result()).then(done),
      }
      return chain
    },
  }),
}))
const one = '00000000-0000-4000-8000-000000000001',
  two = '00000000-0000-4000-8000-000000000002'
const row = (id: string, user: string) => ({
  id,
  organization_id: 'org-one',
  customer: { profile_id: user, organization_id: 'org-one' },
  professional: { name: 'Juan' },
  service_name: 'Corte',
  starts_at: '2099-11-15T15:00:00Z',
  ends_at: '2099-11-15T15:30:00Z',
  status: 'confirmed',
  price: 45000,
  public_token: one,
  service_product_id: two,
  sale_id: null,
  notes: 'Nota interna privada',
})
beforeEach(() => {
  state.user = 'user-one'
  state.reason = null
  state.error = null
  state.filters = []
  state.price = 45000
  state.rows = [row(one, 'user-one'), row(two, 'user-two')]
})
const api = await import('@/app/api/marketplace/profile/appointments/route')
const detail = await import('@/app/api/marketplace/profile/appointments/[id]/route')
const request = (query = '') =>
  new NextRequest('http://localhost/api/marketplace/profile/appointments' + query)
it('lista solo turnos vinculados al usuario autenticado e ignora IDs ajenos de la query', async () => {
  const response = await api.GET(request('?userId=user-two&organization_id=other'))
  expect(response.status).toBe(200)
  const body = await response.json()
  expect(body.items).toHaveLength(1)
  expect(body.items[0].id).toBe(one)
  expect(state.filters).toContainEqual(['customer.profile_id', 'user-one'])
  expect(body.items[0]).not.toHaveProperty('public_token')
  expect(body.items[0]).not.toHaveProperty('notes')
  expect(response.headers.get('Cache-Control')).toContain('no-store')
})
it('rechaza ver el detalle de otro cliente aunque se conozca el ID', async () => {
  expect((await detail.GET(request(), { params: Promise.resolve({ id: two }) })).status).toBe(404)
})
it('permite detalle propio sin devolver notas internas ni perfiles', async () => {
  const response = await detail.GET(request(), { params: Promise.resolve({ id: one }) })
  const body = await response.json()
  expect(body.appointment.store.name).toBe('Barbería Uno')
  expect(body.appointment.managePath).toBe('/turno/' + one)
  expect(body.appointment).not.toHaveProperty('notes')
  expect(body.appointment).not.toHaveProperty('customer')
})
it('un fallo de la base no se disfraza de historial vacío', async () => {
  state.error = { code: 'XX000' }
  expect((await api.GET(request())).status).toBe(500)
})
it('no filtra un turno con organización inconsistente', async () => {
  state.rows[0].customer = { profile_id: 'user-one', organization_id: 'other-org' }
  expect((await api.GET(request())).status).toBe(500)
})
it.each(['unauthenticated', 'inactive', 'mfa_required'])(
  'impide leer con sesión %s',
  async (reason) => {
    state.reason = reason
    expect((await api.GET(request())).status).toBe(reason === 'inactive' ? 403 : 401)
    expect(state.filters).toEqual([])
  },
)
it('valida cursores y tipo de listado', async () => {
  expect((await api.GET(request('?kind=other'))).status).toBe(400)
  expect((await api.GET(request('?cursor=bad'))).status).toBe(400)
})
it('respeta el precio oculto y no ofrece cambios en un turno cobrado', async () => {
  state.price = null as unknown as number
  state.rows[0].sale_id = two
  const response = await detail.GET(request(), { params: Promise.resolve({ id: one }) })
  const data = (await response.json()).appointment
  expect(data.price).toBeNull()
  expect(data.managePath).toBeNull()
})

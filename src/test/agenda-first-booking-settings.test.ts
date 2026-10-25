import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Un comercio que nunca guardó la configuración de la Agenda no tiene fila en
 * agenda_settings. La pantalla muestra el horario por defecto, pero el servidor
 * caía al guardado viejo (insert directo, que una migración bloquea) y el turno
 * no se podía crear: error 500, en la web y en la app. Ahora el primer turno
 * crea la configuración con los valores por defecto y sigue el camino nuevo.
 */
const mocks = vi.hoisted(() => ({
  configs: [] as Array<Record<string, unknown> | null>,
  upserts: [] as Array<{ table: string; row: unknown; options: unknown }>,
  upsertError: null as { message: string } | null,
  rpc: vi.fn(),
  inserts: [] as unknown[],
}))

vi.mock('@/lib/api/withTenantAuth', () => ({
  withTenantAuth: (_options: unknown, handler: (r: Request, c: unknown, rc?: unknown) => Promise<Response>) =>
    (r: Request, rc?: unknown) => handler(r, { organization: { id: 'org-1', role: 'seller' }, user: { id: 'actor-1' } }, rc),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => {
      const q: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'update', 'gte', 'lt', 'order', 'limit']) q[m] = () => q
      q.insert = (row: unknown) => { mocks.inserts.push(row); return q }
      q.maybeSingle = async () => ({ data: { id: 'owned', status: 'confirmed', sale_id: null }, error: null })
      q.single = async () => ({ data: null, error: { message: 'permission denied for table appointments' } })
      return q
    },
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({
    rpc: mocks.rpc,
    from: (table: string) => ({
      upsert: async (row: unknown, options: unknown) => {
        mocks.upserts.push({ table, row, options })
        return { error: mocks.upsertError }
      },
    }),
  }),
}))
vi.mock('@/lib/agenda/agenda-server', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/agenda/agenda-server')>(),
  loadAgendaConfig: async () => mocks.configs.shift() ?? null,
}))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))

import { POST } from '@/app/api/agenda/route'
import { PATCH } from '@/app/api/agenda/[id]/route'

const config = (settingsSaved: boolean, professionalBooking: boolean) => ({ settingsSaved, capabilities: { professionalBooking } })
const body = {
  customer_name: 'Cliente', service_product_id: '11111111-1111-4111-8111-111111111111', professional_id: '22222222-2222-4222-8222-222222222222',
  service_name: 'Corte', price: 50000, starts_at: '2026-10-23T13:00:00.000Z', duration_minutes: 30,
}
const create = () => POST(new NextRequest('http://x/api/agenda', { method: 'POST', body: JSON.stringify(body) }))
const ID = '33333333-3333-4333-8333-333333333333'
const edit = () => PATCH(
  new NextRequest(`http://x/api/agenda/${ID}`, { method: 'PATCH', body: JSON.stringify({ action: 'update', appointment: body }) }),
  { params: Promise.resolve({ id: ID }) },
)

beforeEach(() => {
  mocks.configs = []
  mocks.upserts = []
  mocks.inserts = []
  mocks.upsertError = null
  mocks.rpc.mockReset()
  mocks.rpc.mockResolvedValue({ data: { id: 'appointment-1', price: 50000 }, error: null })
})

describe('el primer turno crea la configuración por defecto de la Agenda', () => {
  it('sin configuración guardada, la crea y agenda por el camino nuevo', async () => {
    mocks.configs = [config(false, false), config(true, true)]
    const response = await create()
    expect(response.status).toBe(201)
    expect(mocks.upserts).toEqual([{ table: 'agenda_settings', row: { organization_id: 'org-1' }, options: { onConflict: 'organization_id', ignoreDuplicates: true } }])
    expect(mocks.rpc).toHaveBeenCalledWith('save_agenda_appointment', expect.objectContaining({ p_org: 'org-1', p_id: null, p_actor: 'actor-1' }))
    expect(mocks.inserts).toHaveLength(0)
  })

  it('solo manda el comercio: los valores son los por defecto de la tabla, los que muestra la pantalla', async () => {
    mocks.configs = [config(false, false), config(true, true)]
    await create()
    expect(Object.keys(mocks.upserts[0].row as object)).toEqual(['organization_id'])
  })

  it('con la configuración ya guardada no la toca', async () => {
    mocks.configs = [config(true, true)]
    expect((await create()).status).toBe(201)
    expect(mocks.upserts).toHaveLength(0)
  })

  it('una base sin las migraciones nuevas sigue con el guardado de antes, sin crear nada', async () => {
    mocks.configs = [config(true, false)]
    await create()
    expect(mocks.upserts).toHaveLength(0)
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.inserts).toHaveLength(1)
  })

  it('si no se puede crear, no inventa: sigue como antes', async () => {
    mocks.upsertError = { message: 'boom' }
    mocks.configs = [config(false, false)]
    await create()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('al editar un turno pasa lo mismo', async () => {
    mocks.configs = [config(false, false), config(true, true)]
    const response = await edit()
    expect(response.status).toBe(200)
    expect(mocks.upserts).toHaveLength(1)
    expect(mocks.rpc).toHaveBeenCalledWith('save_agenda_appointment', expect.objectContaining({ p_org: 'org-1', p_id: ID }))
  })
})

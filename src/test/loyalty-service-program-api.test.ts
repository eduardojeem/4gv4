// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  upsert: vi.fn(),
  select: vi.fn(),
  org: '00000000-0000-0000-0000-000000000001',
  guards: [] as unknown[],
}))
vi.mock('@/lib/api/withTenantAuth', () => ({
  withTenantAuth: (
    options: unknown,
    handler: (
      request: unknown,
      context: { organization: { id: string }; user: { id: string } }
    ) => Promise<Response>
  ) => {
    mocks.guards.push(options)
    return (request: unknown) =>
      handler(request, { organization: { id: mocks.org }, user: { id: mocks.org } })
  },
}))
vi.mock('@/lib/supabase/org-scoped-server', () => ({
  createOrgScopedClient: vi.fn(async () => ({
    rpc: mocks.rpc,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.select }) }),
      upsert: mocks.upsert,
    }),
  })),
}))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }))
const settings = await import('@/app/api/loyalty/settings/route')
const program = await import('@/app/api/loyalty/program/route')
const { createOrgScopedClient } = await import('@/lib/supabase/org-scoped-server')
const request = (url: string, body?: unknown) =>
  new NextRequest(
    'http://localhost' + url,
    body
      ? {
          method: 'PUT',
          body: JSON.stringify(body),
          headers: { 'Content-Type': 'application/json' },
        }
      : undefined
  )
const values = {
  enabled: true,
  currency_per_point: 10000,
  points_per_unit: 1,
  rounding: 'floor',
  earning_mode: 'visits',
  points_per_visit: 2,
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.select.mockResolvedValue({ data: { enabled: true }, error: null })
  mocks.rpc.mockResolvedValue({ data: 1, error: null })
  mocks.upsert.mockReturnValue({
    select: () => ({ single: async () => ({ data: values, error: null }) }),
  })
})
describe('API del programa de fidelización', () => {
  it('expone capacidad sin inventar que la migración está lista', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } })
    const response = await settings.GET(request('/api/loyalty/settings'), {} as never)
    expect((await response.json()).capabilities.serviceVisits).toBe(false)
  })
  it('no guarda modo por turnos sin capacidad disponible', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } })
    const response = await settings.PUT(request('/api/loyalty/settings', values), {} as never)
    expect(response.status).toBe(503)
    expect(mocks.upsert).not.toHaveBeenCalled()
  })
  it('valida puntos por turno antes de escribir', async () => {
    const response = await settings.PUT(
      request('/api/loyalty/settings', { ...values, points_per_visit: 0 }),
      {} as never
    )
    expect(response.status).toBe(400)
    expect(mocks.upsert).not.toHaveBeenCalled()
  })
  it('guarda la configuración bajo la organización autorizada', async () => {
    const response = await settings.PUT(
      request('/api/loyalty/settings', { ...values, organization_id: 'otra' }),
      {} as never
    )
    expect(response.status).toBe(200)
    expect(createOrgScopedClient).toHaveBeenCalledWith(mocks.org)
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: mocks.org,
        earning_mode: 'visits',
        points_per_visit: 2,
      }),
      expect.anything()
    )
  })
  it('no transforma un error de progreso en una lista vacía', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501' } })
    const response = await program.GET(request('/api/loyalty/program'), {} as never)
    expect(response.status).toBe(500)
    expect((await response.json()).customers).toBeUndefined()
  })
  it('rechaza páginas inválidas y no acepta organización desde la query', async () => {
    expect((await program.GET(request('/api/loyalty/program?offset=-1'), {} as never)).status).toBe(
      400
    )
    expect(mocks.rpc).not.toHaveBeenCalled()
    mocks.rpc.mockResolvedValue({ data: { customers: [], total: 0 }, error: null })
    await program.GET(
      request('/api/loyalty/program?organization_id=otra&q=Ana&offset=25'),
      {} as never
    )
    expect(mocks.rpc).toHaveBeenCalledWith('loyalty_program_customers', {
      p_organization_id: mocks.org,
      p_search: 'Ana',
      p_offset: 25,
    })
  })
})

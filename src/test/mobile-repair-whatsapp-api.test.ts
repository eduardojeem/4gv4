import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
const state = vi.hoisted(() => ({
  blocked: false,
  found: true,
  eq: [] as unknown[][],
  fetch: vi.fn(),
}))
vi.mock('@/app/api/repairs/_lib', () => ({
  isNextResponse: (value: unknown) => value instanceof NextResponse,
  resolveRepairRouteContext: async () =>
    state.blocked
      ? NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
      : {
          organizationId: 'org-one',
          branchId: 'branch-one',
          supabase: {
            from: (table: string) => {
              const builder = {
                select: () => builder,
                eq: (...args: unknown[]) => {
                  state.eq.push([table, ...args])
                  return builder
                },
                single: async () => ({
                  data: { name: 'Taller Uno', slug: 'taller-uno', logo_url: null },
                  error: null,
                }),
                maybeSingle: async () => ({
                  data:
                    table === 'organization_settings'
                      ? {
                          display_name: 'Taller Uno',
                          country_code: 'PY',
                        }
                      : { phone: '0981000000', address: 'Dirección real' },
                  error: null,
                }),
              }
              return builder
            },
          },
        },
  fetchRepairById: state.fetch,
}))
vi.mock('@/lib/site-url', () => ({ getSiteUrl: () => 'https://fixture.test' }))
import { GET } from '@/app/api/repairs/[id]/share/route'
const id = '00000000-0000-4000-8000-000000000001'
const request = (query = '') =>
  GET(new NextRequest('https://fixture.test/api/repairs/' + id + '/share' + query), {
    params: Promise.resolve({ id }),
  })
beforeEach(() => {
  state.blocked = false
  state.eq = []
  state.fetch.mockReset().mockResolvedValue({
    error: null,
    data: {
      id,
      ticket_number: 'R-2026-00042',
      created_at: '2026-11-16T12:00:00Z',
      status: 'recibido',
      device_brand: 'Samsung',
      device_model: 'A54',
      device_type: 'smartphone',
      problem_description: 'Pantalla',
      estimated_cost: 100000,
      final_cost: 100000,
      paid_amount: 25000,
      warranty_months: 0,
      access_password: 'PIN-PRIVADO',
      customer: {
        id: 'customer-one',
        name: 'Ana <img src=x onerror=alert(1)>',
        phone: '0981000000',
      },
      parts: [],
      notes: [],
      images: [],
      payments: [],
    },
  })
})
describe('aviso de estado por WhatsApp móvil', () => {
  it('prepara datos actuales del cliente y comercio con enlace firmado sin enviar mensajes', async () => {
    const response = await request()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    const body = await response.json()
    expect(body.phone).toBe('595981000000')
    expect(body.message).toContain('Taller Uno')
    expect(body.message).toContain('R-2026-00042')
    expect(body.message).toContain('verify=')
    expect(body.message).not.toContain('PIN-PRIVADO')
    expect(Object.keys(body).sort()).toEqual(['message', 'phone', 'preparedAt', 'status'])
    expect(state.fetch.mock.calls[0][0].branchId).toBe('branch-one')
  })
  it('no prepara un aviso sin permiso o para una reparación no accesible', async () => {
    state.blocked = true
    expect((await request()).status).toBe(403)
    expect(state.fetch).not.toHaveBeenCalled()
    state.blocked = false
    state.fetch.mockResolvedValue({ error: null, data: null })
    expect((await request()).status).toBe(404)
  })
  it('rechaza teléfonos faltantes en vez de inventar destinatario', async () => {
    state.fetch.mockResolvedValue({
      error: null,
      data: {
        id,
        ticket_number: 'R-2026-00042',
        created_at: '2026-11-16T12:00:00Z',
        status: 'listo',
        customer: { id: 'customer-one', name: 'Ana', phone: '' },
        parts: [],
        notes: [],
        images: [],
        payments: [],
      },
    })
    const response = await request()
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ error: expect.stringMatching(/teléfono válido/) })
  })
})

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
                          repair_receipt_settings: { paperFormat: '58mm' },
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
import { GET } from '@/app/api/repairs/[id]/receipt/route'
const id = '00000000-0000-4000-8000-000000000001'
const request = (query = '') =>
  GET(new NextRequest('https://fixture.test/api/repairs/' + id + '/receipt' + query), {
    params: Promise.resolve({ id }),
  })
beforeEach(() => {
  state.blocked = false
  state.eq = []
  state.fetch
    .mockReset()
    .mockResolvedValue({
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
describe('comprobante web de reparación para móvil', () => {
  it('usa formato y comercio real, escapa textos y no ejecuta auto-print del navegador', async () => {
    const response = await request()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    const body = await response.json()
    expect(body).toMatchObject({ paper: '58mm', width: 164 })
    expect(body.html).toContain('Taller Uno')
    expect(body.html).toContain('R-2026-00042')
    expect(body.html).not.toContain('<script>')
    expect(body.html).not.toContain('<img src=x onerror')
    expect(body.html).not.toContain('PIN-PRIVADO')
    expect(state.eq).toContainEqual(['organization_settings', 'organization_id', 'org-one'])
    expect(state.fetch.mock.calls[0][0].branchId).toBe('branch-one')
  })
  it('rechaza falta de permiso sin consultar el documento', async () => {
    state.blocked = true
    expect((await request()).status).toBe(403)
    expect(state.fetch).not.toHaveBeenCalled()
  })
  it('no permite documentos fuera de la reparación accesible', async () => {
    state.fetch.mockResolvedValue({ data: null, error: null })
    expect((await request()).status).toBe(404)
    expect(state.eq).toEqual([])
  })
  it('rechaza una ficha detallada no ofrecida en móvil y permite elegir A4', async () => {
    expect((await request('?type=technician_detailed')).status).toBe(400)
    const response = await request('?paper=A4&type=technician')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ paper: 'A4', width: 595, height: 842 })
  })
})

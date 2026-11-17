import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
const state = vi.hoisted(() => ({
  blocked: false,
  branchBlocked: false,
  found: true,
  code: 'SKU-ABC123',
  eq: [] as unknown[][],
  options: null as unknown,
}))
vi.mock('@/lib/api/withTenantAuth', () => ({
  withTenantAuth: (
    options: unknown,
    handler: (
      request: NextRequest,
      context: unknown,
      routeContext: unknown,
    ) => Promise<NextResponse>,
  ) => {
    state.options = options
    return (request: NextRequest, context: unknown) =>
      state.blocked
        ? NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
        : handler(
            request,
            {
              user: { id: 'user-one', role: 'admin' },
              organization: { id: 'org-one', name: 'Comercio Uno', catalogServicesOnly: false },
            },
            context,
          )
  },
}))
vi.mock('@/lib/branches/server', () => ({
  getRequestedBranchId: () => 'branch-one',
  resolveBranchScopeForUser: async () => {
    if (state.branchBlocked) throw new Error('other')
    return { branchId: 'branch-one' }
  },
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({
    from: (table: string) => {
      const builder = {
        select: () => builder,
        eq: (...args: unknown[]) => {
          state.eq.push([table, ...args])
          return builder
        },
        maybeSingle: async () => ({
          error: null,
          data: state.found
            ? {
                id: 'product-one',
                name: 'Producto <img src=x>',
                sku: state.code,
                barcode: null,
                unit_measure: 'unidad',
              }
            : null,
        }),
      }
      return builder
    },
  }),
}))
import { GET } from '@/app/api/products/[id]/labels/route'
const id = '00000000-0000-4000-8000-000000000002'
const request = (query = '') =>
  GET(new NextRequest('https://fixture.test/api/products/' + id + '/labels' + query), {
    params: Promise.resolve({ id }),
  })
beforeEach(() => {
  state.blocked = false
  state.branchBlocked = false
  state.found = true
  state.code = 'SKU-ABC123'
  state.eq = []
})
describe('etiquetas móviles con plantilla web', () => {
  it('dibuja código real sin DOM y filtra por negocio', async () => {
    expect(state.options).toMatchObject({
      permission: 'products.read',
      module: ['inventory', 'services'],
    })
    const response = await request('?quantity=2&paper=A4')
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.html).toContain('<svg')
    expect(body.html).toContain('SKU-ABC123')
    expect(body.html).toContain('Comercio Uno')
    expect(body.html).not.toContain('<img src=x>')
    expect(state.eq).toContainEqual(['products', 'organization_id', 'org-one'])
    expect(response.headers.get('cache-control')).toContain('no-store')
  })
  it('no imprime cuando faltan acceso, sucursal o producto', async () => {
    state.blocked = true
    expect((await request()).status).toBe(403)
    state.blocked = false
    state.branchBlocked = true
    expect((await request()).status).toBe(403)
    expect(state.eq).toEqual([])
    state.branchBlocked = false
    state.found = false
    expect((await request()).status).toBe(404)
  })
  it('no inventa un código ni permite cantidades excesivas', async () => {
    state.code = ''
    expect((await request()).status).toBe(422)
    expect((await request('?quantity=101')).status).toBe(400)
  })
})

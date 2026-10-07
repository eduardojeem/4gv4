import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/products/barcode-lookup/route'

const state = vi.hoisted(() => ({ filters: [] as string[], fail: false }))
vi.mock('@/lib/api/withTenantAuth', () => ({
  withTenantAuth: (_options: unknown, handler: (request: Request, context: unknown) => unknown) =>
    (request: Request) => handler(request, { organization: { id: 'tenant-1' } }),
}))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/lib/products/open-product-facts', () => ({ lookupOpenFacts: vi.fn(), openFactsSourcesFor: () => [] }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => ({ from: (table: string) => {
  const query = {
    select: () => query, eq: () => query, in: () => query, limit: () => query,
    neq: (column: string, value: string) => { state.filters.push(`${table}:${column}:${value}`); return query },
    maybeSingle: () => query,
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({
      data: table === 'product_variants' ? [{ product_id: 'other', variant_name: 'Azul', products: { name: 'Otro producto' } }] : null,
      error: state.fail && table === 'products' ? { message: 'unavailable' } : null,
    })),
  }
  return query
} }) }))

describe('consulta de código del producto', () => {
  beforeEach(() => { state.filters = []; state.fail = false })
  it('excluye las variantes del producto editado dentro de la consulta', async () => {
    const response = await GET(new Request('http://localhost/api/products/barcode-lookup?code=2000000000008&excludeId=11111111-1111-4111-8111-111111111111') as never)
    expect(state.filters).toContain('product_variants:product_id:11111111-1111-4111-8111-111111111111')
    expect((await response.json()).data.own.id).toBe('other')
  })
  it('no informa una búsqueda exitosa cuando falló consultar duplicados', async () => {
    state.fail = true
    const response = await GET(new Request('http://localhost/api/products/barcode-lookup?code=2000000000008') as never)
    expect(response.status).toBe(500)
    expect((await response.json()).success).toBe(false)
  })
})

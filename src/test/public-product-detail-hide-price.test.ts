import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * El detalle público de un producto (lo usa la app para la ficha del
 * marketplace) ignoraba «publicado sin precio»: devolvía el precio que la
 * tienda decidió esconder. Ahora no lo manda; solo avisa que está oculto.
 * A un mayorista registrado no se le esconde, igual que en el catálogo.
 */
const state = vi.hoisted(() => ({
  product: null as Record<string, unknown> | null,
  wholesale: false,
  selected: '' as string,
}))

vi.mock('@/lib/saas/public-tenant', () => ({ resolvePublicStorefrontOrganization: async () => ({ id: 'org-1', slug: 'tienda' }) }))
vi.mock('@/lib/api/products-server', () => ({ resolveWholesaleStatus: async () => ({ isWholesale: state.wholesale }) }))
vi.mock('@/lib/products/price-visibility', () => ({ productsHaveHidePriceColumn: async () => true }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {}
      q.select = (fields: string) => { if (table === 'products') state.selected = fields; return q }
      for (const m of ['eq', 'in', 'order']) q[m] = () => q
      q.maybeSingle = async () => ({ data: table === 'products' ? state.product : null, error: null })
      q.then = (ok: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok)
      return q
    },
  }),
}))

import { GET } from '@/app/api/public/products/[id]/route'

const base = {
  id: 'p1', name: 'Remera', sku: 'R1', description: 'Algodón', brand: null, sale_price: 120000, wholesale_price: 90000,
  offer_price: 100000, has_offer: true, stock_quantity: 4, is_active: true, featured: false, image_url: null, images: [],
  unit_measure: 'unidad', barcode: null, has_variants: false, variant_attribute_config: [], category: null,
}
const detail = async () => (await (await GET(new NextRequest('http://x/api/public/products/p1?org=tienda'), { params: Promise.resolve({ id: 'p1' }) })).json()).data

beforeEach(() => {
  state.product = { ...base }
  state.wholesale = false
  state.selected = ''
})

describe('detalle público: «publicado sin precio» no manda el precio', () => {
  it('pide la columna hide_price', async () => {
    await detail()
    expect(state.selected).toContain('hide_price')
  })

  it('con el precio oculto no lo manda, ni la oferta', async () => {
    state.product = { ...base, hide_price: true }
    const data = await detail()
    expect(data.hide_price).toBe(true)
    expect(data.sale_price).toBe(0)
    expect(data.offer_price).toBeNull()
    expect(data.has_offer).toBe(false)
    expect(JSON.stringify(data)).not.toMatch(/120000|100000/)
  })

  it('con el precio a la vista, lo manda como siempre', async () => {
    const data = await detail()
    expect(data.hide_price).toBe(false)
    expect(data.sale_price).toBe(120000)
  })

  it('al mayorista registrado no se le esconde', async () => {
    state.wholesale = true
    state.product = { ...base, hide_price: true }
    const data = await detail()
    expect(data.hide_price).toBe(false)
    expect(data.sale_price).toBe(120000)
  })
})

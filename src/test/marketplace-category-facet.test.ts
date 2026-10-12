import { beforeEach, describe, expect, it, vi } from 'vitest'

const UUID = '3f1c9a52-8b7e-4c1d-9a0f-2e5d7b6c4a13'
const todas = [{ id: UUID, name: 'Accesorios', parent_id: null, product_count: 6, organization_count: 1 }, { id: 'otra', name: 'Electrónica', parent_id: null, product_count: 80, organization_count: 4 }]
const soloLaElegida = [todas[0]]

const readEffectiveCatalog = vi.fn(async (filters?: { category_ids?: string[] }) => ({
  rows: [],
  total: 0,
  brands: [],
  categories: filters?.category_ids ? soloLaElegida : todas,
}))

vi.mock('@/lib/public/effective-catalog', () => ({
  readEffectiveCatalog: (filters: { category_ids?: string[] }) => readEffectiveCatalog(filters),
  MarketplaceCatalogUnavailableError: class extends Error {},
}))

// Lo justo para que la consulta llegue al catálogo: una tienda en vitrina y
// categorías que resuelven al id pedido.
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({
    from: (table: string) => {
      const data = table === 'organizations' ? [{ id: 'org-1' }] : table === 'categories' ? [{ id: UUID }] : []
      const builder: Record<string, unknown> = new Proxy({}, {
        get: (_t, prop) => (prop === 'then'
          ? (ok: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(ok)
          : () => builder),
      })
      return builder
    },
  }),
}))

const { getMarketplaceProductsPage } = await import('@/lib/public/marketplace')

beforeEach(() => readEffectiveCatalog.mockClear())

describe('la lista de categorías del catálogo', () => {
  it('no depende de la categoría elegida: se puede cambiar a otra sin borrar el filtro', async () => {
    const page = await getMarketplaceProductsPage(28, { categoria: UUID, q: 'cable', marca: 'Xiaomi' })

    expect(page.categories).toEqual(todas)
    // La consulta de la lista lleva los demás filtros, sin el de categoría.
    const facet = readEffectiveCatalog.mock.calls.map(([f]) => f).find((f) => !('category_ids' in f) || !f.category_ids)
    expect(facet).toMatchObject({ q: 'cable', brand: 'Xiaomi', limit: 1 })
  })

  it('sin categoría elegida no hace una consulta de más', async () => {
    readEffectiveCatalog.mockClear()
    await getMarketplaceProductsPage(28, { q: 'cable' })
    expect(readEffectiveCatalog).toHaveBeenCalledTimes(1)
  })
})

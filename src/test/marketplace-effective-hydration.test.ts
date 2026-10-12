import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const state = vi.hoisted(() => ({ drop: false }))
const id = '22000000-0000-4000-8000-000000000016'
const organizationId = '11000000-0000-4000-8000-000000000001'
vi.mock('@/lib/public/effective-catalog', () => ({
  readEffectiveCatalog: async () => ({ total: 16, brands: [], categories: [], rows: [{ product_id: id,
    summary: { stockQuantity: 3, price: 80, originalPrice: null, priceFrom: true, hasOffer: false, representativeVariantId: null, promotionName: null },
    pricing: { has_offer: false, offer_price: null, promotion_name: null } }] }),
  MarketplaceCatalogUnavailableError: class extends Error { constructor() { super('Marketplace temporalmente no disponible') } },
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => ({
  from(table: string) {
    let rows: Record<string, unknown>[] = table === 'organizations' ? [{ id: organizationId }]
      : table === 'products' && !state.drop ? [{ id, organization_id: organizationId, name: 'Variant product', sku: 'sku',
        sale_price: 100, stock_quantity: 0, is_active: true, visibility: 'public', has_variants: true, hide_price: false,
        organizations: { id: organizationId, name: 'Store', slug: 'store' } }]
      : table === 'product_variants' ? [{ id: '33000000-0000-4000-8000-000000000001', product_id: id, sale_price: 80, stock_quantity: 3, is_active: true, attributes: {} }]
      : []
    const builder = new Proxy({}, { get(_target, key) {
      if (key === 'then') return (resolve: (value: unknown) => unknown) => resolve({ data: rows, count: rows.length, error: null })
      return (...args: unknown[]) => {
        if (key === 'gt' && args[0] === 'stock_quantity') rows = rows.filter((row) => Number(row.stock_quantity) > Number(args[1]))
        return builder
      }
    } })
    return builder
  },
}) }))
import { getMarketplaceOrganizations, getMarketplaceProductsPage } from '@/lib/public/marketplace'

beforeEach(() => { state.drop = false })
describe('effective catalog hydration', () => {
  it('uses effective totals and summaries for organization showcases too', async () => {
    const organizations = await getMarketplaceOrganizations(12, { q: 'Store' })
    expect(organizations[0].products_count).toBe(16)
    expect(organizations[0].featured_products[0]).toMatchObject({ catalog_summary: { price: 80 }, stock_quantity: 3 })
  })
  it('keeps SQL total and variant stock without replacing parent price', async () => {
    const result = await getMarketplaceProductsPage(12, { q: 'Variant product' })
    expect(result.total).toBe(16)
    expect(result.products[0]).toMatchObject({ sale_price: 100, stock_quantity: 3, in_stock: true,
      catalog_summary: { price: 80, priceFrom: true } })
  })
  it('does not silently return incomplete results when a selected product disappears', async () => {
    state.drop = true
    await expect(getMarketplaceProductsPage(12, { q: 'Variant product' })).rejects.toThrow('Marketplace temporalmente no disponible')
  })
})

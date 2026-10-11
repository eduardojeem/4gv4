import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: (...args: unknown[]) => unknown) => fn }))
const state = vi.hoisted(() => ({ filters: [] as Array<Record<string, unknown>> }))
vi.mock('@/lib/public/effective-catalog', () => ({
  readEffectiveCatalog: async (filters: Record<string, unknown>) => {
    state.filters.push(filters)
    return { rows: [], total: 0, brands: [{ name: 'Brand', product_count: 2, organization_count: 1, logo_url: null }],
      categories: [{ id: '22000000-0000-4000-8000-000000000001', name: 'Category', parent_id: null, product_count: 2, organization_count: 1 }] }
  },
  MarketplaceCatalogUnavailableError: class extends Error {},
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => ({ from() {
  const builder = new Proxy({}, { get(_target, key) {
    if (key === 'then') return (resolve: (value: unknown) => unknown) => resolve({ data: [], error: null })
    return () => builder
  } })
  return builder
} }) }))
import { getMarketplaceBrands, getMarketplaceCategories, getMarketplaceOffers } from '@/lib/public/marketplace'

describe('effective public catalog consumers', () => {
  it('derives category counts from available catalog options', async () => {
    expect(await getMarketplaceCategories()).toMatchObject([{ name: 'Category', product_count: 2 }])
  })
  it('derives brand counts from available catalog options', async () => {
    expect(await getMarketplaceBrands()).toMatchObject([{ name: 'Brand', product_count: 2 }])
  })
  it('uses the same selection pipeline for homepage offers', async () => {
    await getMarketplaceOffers(12)
    expect(state.filters).toContainEqual(expect.objectContaining({ only_offers: true, limit: 12 }))
  })
})

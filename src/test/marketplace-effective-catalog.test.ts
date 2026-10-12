import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const state = vi.hoisted(() => ({ data: null as unknown, error: null as unknown }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => ({ rpc: async () => state }) }))
import { readEffectiveCatalog } from '@/lib/public/effective-catalog'

const row = { product_id: '22000000-0000-4000-8000-000000000001',
  summary: { stockQuantity: 3, price: 80, originalPrice: 100, priceFrom: true, hasOffer: true,
    representativeVariantId: '33000000-0000-4000-8000-000000000001', promotionName: null },
  pricing: { has_offer: true, offer_price: 80, promotion_name: null } }

beforeEach(() => { state.data = { rows: [row], total: 16, brands: [], categories: [] }; state.error = null })
describe('effective catalog server boundary', () => {
  it('preserves server total and summary independently of the visible page', async () => {
    expect(await readEffectiveCatalog({ limit: 12, offset: 0 })).toMatchObject({ total: 16, rows: [row] })
  })
  it('preserves totals for a page without rows', async () => {
    state.data = { rows: [], total: 16, brands: [], categories: [] }
    expect(await readEffectiveCatalog({ limit: 12, offset: 100 })).toMatchObject({ total: 16, rows: [] })
  })
  it('does not translate a missing migration to an empty catalog', async () => {
    state.error = { code: 'PGRST202', message: 'private database details' }
    await expect(readEffectiveCatalog({ limit: 12 })).rejects.toThrow('Marketplace temporalmente no disponible')
  })
  it('rejects incomplete or invalid database results', async () => {
    state.data = { rows: [{ product_id: 'bad' }], total: 1, brands: [], categories: [] }
    await expect(readEffectiveCatalog({ limit: 12 })).rejects.toThrow('Marketplace temporalmente no disponible')
  })
  it('rejects offsets beyond PostgreSQL integer capacity', async () => {
    await expect(readEffectiveCatalog({ limit: 12, offset: Number.MAX_SAFE_INTEGER })).rejects.toThrow('INVALID_CATALOG_FILTERS')
  })
})

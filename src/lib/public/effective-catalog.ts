import 'server-only'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import type { PublicCatalogSummary } from './catalog-summary'

export type EffectiveCatalogFilters = {
  organization_id?: string;
  q?: string; category_ids?: string[]; brand?: string; brand_ids?: string[];
  only_offers?: boolean; sort?: 'default' | 'price_asc' | 'price_desc' | 'newest' | 'name_asc';
  limit: number; offset?: number;
}
export type EffectiveCatalogResult = {
  rows: Array<{ product_id: string; summary: PublicCatalogSummary;
    pricing: { has_offer: boolean; offer_price: number | null; promotion_name: string | null } | null }>
  total: number
  brands: Array<{ name: string; product_count: number; organization_count: number; logo_url: string | null }>
  categories: Array<{ id: string; name: string; parent_id: string | null; product_count: number; organization_count: number }>
}
export class MarketplaceCatalogUnavailableError extends Error {
  constructor() { super('Marketplace temporalmente no disponible'); this.name = 'MarketplaceCatalogUnavailableError' }
}
const summarySchema = z.object({
  stockQuantity: z.number().finite().nonnegative(), price: z.number().finite().nonnegative().nullable(),
  originalPrice: z.number().finite().nonnegative().nullable(), priceFrom: z.boolean(), hasOffer: z.boolean(),
  representativeVariantId: z.string().uuid().nullable(), promotionName: z.string().nullable(),
})
const resultSchema = z.object({
  total: z.number().int().nonnegative(),
  rows: z.array(z.object({ product_id: z.string().uuid(), summary: summarySchema,
    pricing: z.object({ has_offer: z.boolean(), offer_price: z.number().finite().nonnegative().nullable(), promotion_name: z.string().nullable() }).nullable(),
  })),
  brands: z.array(z.object({ name: z.string(), product_count: z.number().int().nonnegative(), organization_count: z.number().int().nonnegative(), logo_url: z.string().nullable() })),
  categories: z.array(z.object({ id: z.string().uuid(), name: z.string(), parent_id: z.string().uuid().nullable(), product_count: z.number().int().nonnegative(), organization_count: z.number().int().nonnegative() })),
})
const filterSchema = z.object({
  organization_id: z.string().uuid().optional(),
  q: z.string().max(120).optional(), category_ids: z.array(z.string().uuid()).optional(),
  brand: z.string().max(100).optional(), brand_ids: z.array(z.string().uuid()).optional(),
  only_offers: z.boolean().optional(), sort: z.enum(['default','price_asc','price_desc','newest','name_asc']).optional(),
  limit: z.number().int().min(1).max(100), offset: z.number().int().min(0).max(2147483647).optional(),
})
export async function readEffectiveCatalog(filters: EffectiveCatalogFilters): Promise<EffectiveCatalogResult> {
  const parsedFilters = filterSchema.safeParse(filters)
  if (!parsedFilters.success) throw new Error('INVALID_CATALOG_FILTERS')
  try {
    const { data, error } = await createAdminSupabase().rpc('get_marketplace_effective_catalog', { p_filters: parsedFilters.data })
    if (error) throw new MarketplaceCatalogUnavailableError()
    const result = resultSchema.safeParse(data)
    if (!result.success) throw new MarketplaceCatalogUnavailableError()
    return {
      total: result.data.total,
      rows: result.data.rows.map(({ product_id, summary, pricing }) => ({
        product_id,
        summary: { ...summary, price: summary.price ?? null, originalPrice: summary.originalPrice ?? null,
          representativeVariantId: summary.representativeVariantId ?? null, promotionName: summary.promotionName ?? null },
        pricing: pricing ? { has_offer: pricing.has_offer, offer_price: pricing.offer_price ?? null,
          promotion_name: pricing.promotion_name ?? null } : null,
      })),
      brands: result.data.brands.map((brand) => ({ ...brand, logo_url: brand.logo_url ?? null })),
      categories: result.data.categories.map((category) => ({ ...category, parent_id: category.parent_id ?? null })),
    }
  } catch {
    throw new MarketplaceCatalogUnavailableError()
  }
}

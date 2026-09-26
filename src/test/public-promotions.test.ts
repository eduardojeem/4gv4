import { describe, expect, it } from 'vitest'
import {
  applyAutomaticPromotionToProduct,
  buildPublicOfferCandidateFilter,
  evaluatePublicCoupon,
  type PublicPromotion,
} from '@/lib/public-promotions'

const automatic: PublicPromotion = {
  id: 'automatic',
  code: 'AUTO20',
  name: 'Oferta publica',
  type: 'percentage',
  value: 20,
  min_purchase: 0,
  max_discount: null,
  applicable_products: ['product-1'],
  applicable_categories: [],
  start_date: null,
  end_date: null,
  is_active: true,
  usage_count: 0,
  usage_limit: null,
  public_mode: 'automatic',
}

describe('public promotions', () => {
  it('turns an eligible automatic promotion into a public product offer', () => {
    const result = applyAutomaticPromotionToProduct(
      { id: 'product-1', category_id: null, sale_price: 100_000, has_offer: false, offer_price: null },
      [automatic],
    )

    expect(result.has_offer).toBe(true)
    expect(result.offer_price).toBe(80_000)
    expect(result.promotion_name).toBe('Oferta publica')
  })

  it('does not expose coupon-only promotions as product offers', () => {
    const result = applyAutomaticPromotionToProduct(
      { id: 'product-1', category_id: null, sale_price: 100_000, has_offer: false, offer_price: null },
      [{ ...automatic, public_mode: 'coupon' }],
    )

    expect(result.has_offer).toBe(false)
    expect(result.offer_price).toBeNull()
  })

  // Los ids acá son UUID a propósito: products.id y products.category_id son
  // columnas uuid, y el filtro descarta cualquier valor que no lo sea.
  const PRODUCT_UUID = '11111111-1111-4111-8111-111111111111'
  const CATEGORY_UUID = '22222222-2222-4222-8222-222222222222'

  it('includes automatic promotion targets in the database offer filter', () => {
    const filter = buildPublicOfferCandidateFilter([
      { ...automatic, applicable_products: [PRODUCT_UUID] },
      { ...automatic, id: 'category-offer', applicable_products: [], applicable_categories: [CATEGORY_UUID] },
    ])

    expect(filter).toBe(`has_offer.eq.true,id.in.(${PRODUCT_UUID}),category_id.in.(${CATEGORY_UUID})`)
  })

  it('drops non-uuid sentinels so the query is not aborted by a type error', () => {
    // El formulario del dashboard guarda 'service' en applicable_categories para
    // las promos de reparaciones. Mandarlo a un filtro sobre una columna uuid
    // hace fallar la consulta entera.
    const filter = buildPublicOfferCandidateFilter([
      { ...automatic, applicable_products: [], applicable_categories: ['service'] },
    ])

    expect(filter).toBe('has_offer.eq.true')
  })

  it('does not include expired automatic promotions in the database offer filter', () => {
    const filter = buildPublicOfferCandidateFilter(
      [{ ...automatic, end_date: '2026-01-01T00:00:00.000Z' }],
      new Date('2026-02-01T00:00:00.000Z'),
    )

    expect(filter).toBe('has_offer.eq.true')
  })

  it('validates a public coupon against eligible cart lines', () => {
    const result = evaluatePublicCoupon(
      { ...automatic, public_mode: 'coupon', code: 'AHORRA20' },
      [{ product_id: 'product-1', category_id: null, quantity: 2, unit_price: 50_000 }],
    )

    expect(result.valid).toBe(true)
    expect(result.discount_amount).toBe(20_000)
  })

  it('rejects expired or exhausted coupons', () => {
    const result = evaluatePublicCoupon(
      { ...automatic, public_mode: 'coupon', usage_limit: 2, usage_count: 2 },
      [{ product_id: 'product-1', category_id: null, quantity: 1, unit_price: 100_000 }],
    )

    expect(result.valid).toBe(false)
    expect(result.reason).toContain('límite')
  })
})

import { describe, expect, it } from 'vitest'
import { summarizeCatalogProduct } from '@/lib/public/catalog-summary'
import type { PublicPromotion } from '@/lib/public-promotions'

const now = new Date('2026-10-11T12:00:00Z')
const product = { id: 'product', category_id: 'category', sale_price: 100, stock_quantity: 0, has_variants: true, has_offer: false }
const variant = (id: string, price: number, stock = 1) => ({ id, sale_price: price, stock_quantity: stock, is_active: true })
const promotion: PublicPromotion = {
  id: 'promotion', name: 'Promo', code: '', type: 'percentage', value: 30,
  min_purchase: null, max_discount: null, applicable_products: ['product'], applicable_categories: null,
  start_date: null, end_date: null, is_active: true, usage_count: 0, usage_limit: null, public_mode: 'automatic',
}

describe('effective public catalog summaries', () => {
  it('uses available active variants even when the parent is depleted', () => {
    expect(summarizeCatalogProduct(product, [variant('a', 100, 2), variant('b', 150, 3)], [], { now }))
      .toMatchObject({ stockQuantity: 5, price: 100, priceFrom: true, representativeVariantId: 'a' })
  })
  it('does not let depleted or inactive variants set the starting price', () => {
    expect(summarizeCatalogProduct(product, [variant('a', 50, 0), { ...variant('b', 40), is_active: false }, variant('c', 100)], [], { now }))
      .toMatchObject({ price: 100, stockQuantity: 1, priceFrom: false })
  })
  it('does not fall back to parent stock when all variants are depleted', () => {
    expect(summarizeCatalogProduct({ ...product, stock_quantity: 20 }, [variant('a', 100, 0)], [], { now })).toBeNull()
    expect(summarizeCatalogProduct({ ...product, stock_quantity: 20 }, [], [], { now })).toBeNull()
  })
  it('pairs the proportional offer with the same representative variant original price', () => {
    expect(summarizeCatalogProduct({ ...product, has_offer: true, offer_price: 80 }, [variant('a', 100), variant('b', 150)], [], { now }))
      .toMatchObject({ price: 80, originalPrice: 100, hasOffer: true, priceFrom: true })
  })
  it('does not label equal available prices as starting prices', () => {
    expect(summarizeCatalogProduct(product, [variant('b', 100), variant('a', 100)], [], { now }))
      .toMatchObject({ priceFrom: false, representativeVariantId: 'a' })
  })
  it('keeps a simple product price and stock', () => {
    expect(summarizeCatalogProduct({ ...product, has_variants: false, stock_quantity: 2 }, [], [], { now }))
      .toMatchObject({ price: 100, stockQuantity: 2, priceFrom: false, hasOffer: false })
  })
  it('chooses the better promotion without accumulating discounts', () => {
    expect(summarizeCatalogProduct({ ...product, has_offer: true, offer_price: 80 }, [variant('a', 100)], [promotion], { now }))
      .toMatchObject({ price: 70, promotionName: 'Promo', originalPrice: 100 })
  })
  it.each([
    { end_date: '2026-10-10T12:00:00Z' }, { is_active: false }, { usage_limit: 1, usage_count: 1 },
    { public_mode: 'coupon' as const }, { type: 'fixed' as const }, { min_purchase: 200 },
  ])('does not advertise ineligible promotions: %j', (change) => {
    expect(summarizeCatalogProduct(product, [variant('a', 100)], [{ ...promotion, ...change }], { now }))
      .toMatchObject({ price: 100, hasOffer: false })
  })
  it('offers-only chooses a discounted option rather than a cheaper non-offer', () => {
    expect(summarizeCatalogProduct(product, [variant('a', 80), { ...variant('b', 100), offer_price: 90 }], [], { now, onlyOffers: true }))
      .toMatchObject({ price: 90, originalPrice: 100, representativeVariantId: 'b', priceFrom: false, stockQuantity: 2 })
    expect(summarizeCatalogProduct(product, [variant('a', 100)], [], { now, onlyOffers: true })).toBeNull()
  })
  it('does not expose a hidden numeric summary', () => {
    expect(summarizeCatalogProduct({ ...product, hide_price: true }, [variant('a', 100), variant('b', 150)], [], { now }))
      .toMatchObject({ price: null, originalPrice: null, priceFrom: false, representativeVariantId: null })
  })
  it('preserves variant offer precedence and integer rounding', () => {
    expect(summarizeCatalogProduct({ ...product, has_offer: true, offer_price: 80 }, [{ ...variant('a', 150), offer_price: 140 }], [], { now }))
      .toMatchObject({ price: 140, originalPrice: 150 })
    expect(summarizeCatalogProduct({ ...product, has_offer: true, offer_price: 80 }, [variant('a', 101)], [], { now }))
      .toMatchObject({ price: 81, originalPrice: 101 })
  })
  it('keeps the promotion name when a loaded variant offer is invalid', () => {
    expect(summarizeCatalogProduct(product, [{ ...variant('a', 100), offer_price: 150 }], [promotion], { now }))
      .toMatchObject({ price: 70, promotionName: 'Promo' })
  })
})

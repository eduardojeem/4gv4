import { describe, expect, it } from 'vitest'
import { getOfferPricing } from '@/lib/public/marketplace-offers'
import type { PublicCatalogSummary } from '@/lib/public/catalog-summary'

const summary: PublicCatalogSummary = { stockQuantity: 3, price: 80, originalPrice: 100, priceFrom: true,
  hasOffer: true, representativeVariantId: null, promotionName: null }

describe('effective catalog price presentation', () => {
  it('uses the representative available variant, not the parent price', () => {
    const product = { sale_price: 200, catalog_summary: summary }
    expect(getOfferPricing(product)).toMatchObject({ price: 80, regularPrice: 100, savings: 20, percent: 20, hasOffer: true, priceFrom: true })
  })
  it('does not expose numeric price for a hidden summary', () => {
    const product = { sale_price: 999999, catalog_summary: { ...summary, price: null, originalPrice: null, priceFrom: false, hasOffer: false } }
    expect(getOfferPricing(product)).toMatchObject({ price: 0, regularPrice: 0, hasOffer: false, priceFrom: false })
  })
  it('does not add a starting-price prefix for equal option prices', () => {
    const product = { sale_price: 200, catalog_summary: { ...summary, priceFrom: false } }
    expect(getOfferPricing(product)).toMatchObject({ priceFrom: false })
  })
})

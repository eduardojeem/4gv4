import { describe, expect, it } from 'vitest'
import { resolveCatalogPartPrice } from './catalog-part-pricing'

describe('resolveCatalogPartPrice', () => {
  const product = { purchase_price: 70_000, sale_price: 120_000, wholesale_price: 95_000 }

  it('uses the current retail price instead of a browser supplied amount', () => {
    expect(resolveCatalogPartPrice(product, false)).toEqual({ unitCost: 70_000, unitPrice: 120_000 })
  })

  it('uses the current wholesale price when the repair customer qualifies', () => {
    expect(resolveCatalogPartPrice(product, true)).toEqual({ unitCost: 70_000, unitPrice: 95_000 })
  })

  it('falls back to retail when wholesale pricing is not configured', () => {
    expect(resolveCatalogPartPrice({ ...product, wholesale_price: 0 }, true).unitPrice).toBe(120_000)
  })

  it('uses an active offer as the current retail price', () => {
    expect(resolveCatalogPartPrice({ ...product, offer_price: 105_000 }, false).unitPrice).toBe(105_000)
  })
})

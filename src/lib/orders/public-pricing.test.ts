import { describe, expect, it } from 'vitest'

import { resolvePublicUnitPrice } from './public-pricing'

const base = {
  isWholesale: false,
  wholesalePrice: null,
  salePrice: 100_000,
  hasOffer: false,
  offerPrice: null,
}

describe('resolvePublicUnitPrice', () => {
  it('charges the list price to a retail customer', () => {
    expect(resolvePublicUnitPrice(base)).toBe(100_000)
  })

  it('charges the offer price when it actually lowers the list price', () => {
    expect(resolvePublicUnitPrice({ ...base, hasOffer: true, offerPrice: 80_000 })).toBe(80_000)
  })

  it('ignores an offer that does not lower the list price', () => {
    expect(resolvePublicUnitPrice({ ...base, hasOffer: true, offerPrice: 120_000 })).toBe(100_000)
  })

  // El bug original: el mayorista veía su precio en el catálogo y el checkout
  // le cobraba el minorista.
  it('charges the wholesale price to a wholesale customer', () => {
    expect(resolvePublicUnitPrice({
      ...base,
      isWholesale: true,
      wholesalePrice: 70_000,
    })).toBe(70_000)
  })

  it('does not stack retail offers on top of the wholesale price', () => {
    expect(resolvePublicUnitPrice({
      ...base,
      isWholesale: true,
      wholesalePrice: 70_000,
      hasOffer: true,
      offerPrice: 80_000,
    })).toBe(70_000)
  })

  it('falls back to the list price when a wholesale customer buys a product without wholesale price', () => {
    expect(resolvePublicUnitPrice({ ...base, isWholesale: true, wholesalePrice: null })).toBe(100_000)
  })

  it('treats a zero or negative wholesale price as not configured', () => {
    expect(resolvePublicUnitPrice({ ...base, isWholesale: true, wholesalePrice: 0 })).toBe(100_000)
    expect(resolvePublicUnitPrice({ ...base, isWholesale: true, wholesalePrice: -5 })).toBe(100_000)
  })

  it('never returns a negative or non-finite price', () => {
    expect(resolvePublicUnitPrice({ ...base, salePrice: Number.NaN })).toBe(0)
    expect(resolvePublicUnitPrice({ ...base, salePrice: -10 })).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import { getOfferPricing, isOnOffer, mergeOffersIntoCatalog, sortOffersByDiscount } from './marketplace-offers'

const product = (id: string, sale: number, offer: number | null, hasOffer = true) => ({
  id,
  organization_slug: 'tienda',
  sale_price: sale,
  offer_price: offer,
  has_offer: hasOffer,
})

describe('ofertas del marketplace', () => {
  it('calcula precio, ahorro y porcentaje', () => {
    expect(getOfferPricing(product('a', 200000, 150000))).toEqual({
      hasOffer: true, price: 150000, regularPrice: 200000, savings: 50000, percent: 25,
    })
  })

  it('no toma como oferta un precio igual, mayor, cero o sin marcar', () => {
    expect(isOnOffer(product('a', 100, 100))).toBe(false)
    expect(isOnOffer(product('a', 100, 120))).toBe(false)
    expect(isOnOffer(product('a', 100, 0))).toBe(false)
    expect(isOnOffer(product('a', 100, 80, false))).toBe(false)
    expect(getOfferPricing(product('a', 100, null)).price).toBe(100)
  })

  it('ordena por mayor descuento y, a igual porcentaje, por mayor ahorro', () => {
    const sorted = sortOffersByDiscount([
      product('10%', 100000, 90000),
      product('sin', 100000, null),
      product('50%-chico', 10000, 5000),
      product('50%-grande', 400000, 200000),
    ])
    expect(sorted.map((p) => p.id)).toEqual(['50%-grande', '50%-chico', '10%'])
  })

  it('suma al catálogo las ofertas que faltan, sin duplicar', () => {
    const catalog = [product('a', 100, null), product('b', 100, 80)]
    const offers = [product('b', 100, 80), product('c', 100, 70)]
    expect(mergeOffersIntoCatalog(catalog, offers).map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(mergeOffersIntoCatalog(catalog, [product('b', 100, 80)])).toBe(catalog)
  })
})

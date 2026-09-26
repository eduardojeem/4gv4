import { describe, expect, it } from 'vitest'
import { resolveOfferPrice } from './offer-pricing'

describe('resolveOfferPrice', () => {
  it('aplica el mismo porcentaje de descuento a la variante', () => {
    expect(resolveOfferPrice(100_000, 80_000, 120_000)).toBe(96_000)
    expect(resolveOfferPrice(89_000, 79_000, 89_000)).toBe(79_000)
  })
  it('mantiene el precio de variante cuando no hay una oferta válida', () => {
    expect(resolveOfferPrice(100_000, null, 120_000)).toBe(120_000)
    expect(resolveOfferPrice(100_000, 100_000, 120_000)).toBe(120_000)
  })
})

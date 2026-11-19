import { describe, expect, it } from 'vitest'
import { variantExplicitWholesale, variantRetailPrice, variantUnitPrice } from './variant-pricing'

// Mismos casos que la prueba de la migración 20261118120000 en Postgres.
const product = { sale_price: 100000, wholesale_price: 90000 }
const small = { sale_price: 100000, wholesale_price: null }
const large = { sale_price: 150000, wholesale_price: null }
const huge = { sale_price: 160000, wholesale_price: 140000 }

describe('precio de la línea con variante', () => {
  it('minorista: cada variante con su precio', () => {
    expect(variantUnitPrice(product, small, 'retail')).toBe(100000)
    expect(variantUnitPrice(product, large, 'retail')).toBe(150000)
    expect(variantUnitPrice(product, huge, 'retail')).toBe(160000)
  })

  it('una variante con precio 0 usa el del producto', () => {
    expect(variantRetailPrice(product, { sale_price: 0 })).toBe(100000)
  })

  it('mayorista: propio, heredado si cuesta lo mismo, o -10% si cuesta otra cosa', () => {
    expect(variantUnitPrice(product, small, 'wholesale')).toBe(90000)
    expect(variantUnitPrice(product, large, 'wholesale')).toBe(135000)
    expect(variantUnitPrice(product, huge, 'wholesale')).toBe(140000)
    expect(variantUnitPrice(product, null, 'wholesale')).toBe(90000)
  })

  it('sin mayorista en el producto, la variante usa su precio -10%', () => {
    expect(variantUnitPrice({ sale_price: 100000 }, small, 'wholesale')).toBe(90000)
    expect(variantExplicitWholesale({ sale_price: 100000 }, small)).toBeNull()
  })

  it('un mayorista 0 de la variante no cuenta como propio', () => {
    expect(variantExplicitWholesale(product, { sale_price: 100000, wholesale_price: 0 })).toBe(90000)
  })
})

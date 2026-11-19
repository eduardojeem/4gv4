import { describe, expect, it } from 'vitest'
import type { ProductVariantInput } from './variant-contract'
import { applyLinkedBasePrices, createPriceLinks, registerPriceLinks, unlinkEditedPrices } from './variant-price-links'

const variant = (key: string, patch: Partial<ProductVariantInput> = {}): ProductVariantInput => ({
  clientKey: key, name: key, attributes: { talle: key }, sku: key, purchasePrice: 50000, salePrice: 100000,
  wholesalePrice: 90000, minStock: 0, stockQuantity: 1, isActive: true, ...patch,
})
const base = { salePrice: 100000, wholesalePrice: 90000, purchasePrice: 50000 }

describe('variantes que siguen los precios del producto', () => {
  it('las que tenían el mismo precio toman el nuevo; las de precio propio no', () => {
    const links = createPriceLinks()
    const variants = [variant('S'), variant('XL', { salePrice: 150000, wholesalePrice: undefined })]
    registerPriceLinks(links, variants, base)
    const next = applyLinkedBasePrices(variants, links, { ...base, salePrice: 120000, wholesalePrice: 100000 }, { canUpdateCost: true })
    expect(next[0]).toMatchObject({ salePrice: 120000, wholesalePrice: 100000 })
    expect(next[1]).toMatchObject({ salePrice: 150000, wholesalePrice: undefined })
  })

  it('tipear el precio del producto no arrastra variantes que coinciden con un valor intermedio', () => {
    const links = createPriceLinks()
    const variants = [variant('S'), variant('M', { salePrice: 15 })]
    registerPriceLinks(links, variants, base)
    let current = variants
    for (const salePrice of [1, 15, 150, 150000]) current = applyLinkedBasePrices(current, links, { ...base, salePrice }, { canUpdateCost: true })
    expect(current.map(v => v.salePrice)).toEqual([150000, 15])
  })

  it('un precio de venta vacío no se copia', () => {
    const links = createPriceLinks()
    const variants = [variant('S')]
    registerPriceLinks(links, variants, base)
    expect(applyLinkedBasePrices(variants, links, { ...base, salePrice: 0 }, { canUpdateCost: true })).toBe(variants)
  })

  it('editar la variante corta el vínculo', () => {
    const links = createPriceLinks()
    const variants = [variant('S')]
    registerPriceLinks(links, variants, base)
    unlinkEditedPrices(links, 'S', { salePrice: 110000 })
    const next = applyLinkedBasePrices([{ ...variants[0], salePrice: 110000 }], links, { ...base, salePrice: 130000 }, { canUpdateCost: true })
    expect(next[0].salePrice).toBe(110000)
  })

  it('el costo solo se copia con permiso y nunca se borra', () => {
    const links = createPriceLinks()
    const variants = [variant('S')]
    registerPriceLinks(links, variants, base)
    expect(applyLinkedBasePrices(variants, links, { ...base, purchasePrice: 60000 }, { canUpdateCost: false })).toBe(variants)
    expect(applyLinkedBasePrices(variants, links, { ...base, purchasePrice: null }, { canUpdateCost: true })).toBe(variants)
    expect(applyLinkedBasePrices(variants, links, { ...base, purchasePrice: 60000 }, { canUpdateCost: true })[0].purchasePrice).toBe(60000)
  })

  it('una variante sin costo informado no se vincula al costo del producto', () => {
    const links = createPriceLinks()
    const variants = [variant('S', { purchasePrice: null })]
    registerPriceLinks(links, variants, base)
    expect(applyLinkedBasePrices(variants, links, { ...base, purchasePrice: 60000 }, { canUpdateCost: true })[0].purchasePrice).toBeNull()
  })
})

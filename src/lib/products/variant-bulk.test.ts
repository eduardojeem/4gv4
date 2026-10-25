import { expect, it } from 'vitest'
import { applyVariantBulkAction } from './variant-bulk'
const v = (key: string) => ({ clientKey: key, name: key, attributes: { color: key }, sku: key, salePrice: 10, purchasePrice: 5, stockQuantity: 1, minStock: 0, isActive: true })
const variants = [v('Negro'), v('Blanco')]
const selected = new Set(['Negro'])
it('changes only selection and preserves IDs/data outside action', () => {
  const next = applyVariantBulkAction(variants, selected, { type: 'price', value: 25 }, { canUpdateCost: false })
  expect(next[0]).toMatchObject({ salePrice: 25, purchasePrice: 5, stockQuantity: 1 })
  expect(next[1]).toBe(variants[1])
})
it('separates clear cost from explicit zero and requires write permission', () => {
  expect(applyVariantBulkAction(variants, selected, { type: 'clearCost' }, { canUpdateCost: true })[0].purchasePrice).toBeNull()
  expect(applyVariantBulkAction(variants, selected, { type: 'cost', value: 0 }, { canUpdateCost: true })[0].purchasePrice).toBe(0)
  expect(() => applyVariantBulkAction(variants, selected, { type: 'clearCost' }, { canUpdateCost: false })).toThrow('permiso')
})
it('requires branch context for integral stock', () => {
  expect(() => applyVariantBulkAction(variants, selected, { type: 'stock', value: 2 }, { canUpdateCost: true })).toThrow('sucursal')
  expect(applyVariantBulkAction(variants, selected, { type: 'stock', value: 2 }, { canUpdateCost: true, branchId: 'branch' })[0].stockQuantity).toBe(2)
  expect(() => applyVariantBulkAction(variants, selected, { type: 'stock', value: 1.5 }, { canUpdateCost: true, branchId: 'branch' })).toThrow('válido')
})
it('changes status without permitting every variant to become inactive', () => {
  expect(applyVariantBulkAction(variants, selected, { type: 'active', value: false }, { canUpdateCost: false })[0].isActive).toBe(false)
  expect(() => applyVariantBulkAction(variants, new Set(['Negro', 'Blanco']), { type: 'active', value: false }, { canUpdateCost: false })).toThrow('activa')
})
it('suggests SKUs and rejects normalized draft duplicates against unselected variants', () => {
  expect(applyVariantBulkAction(variants, selected, { type: 'sku', base: 'IPH15' }, { canUpdateCost: false })[0].sku).toBe('IPH15-NEG')
  expect(() => applyVariantBulkAction([v('Negro'), { ...v('Otro'), sku: ' iph15-neg ' }], selected, { type: 'sku', base: 'IPH15' }, { canUpdateCost: false })).toThrow('duplicado')
})

import { expect, it } from 'vitest'
import { previewVariantCombinations } from './variant-editor-model'
const v = { id: 'existing', clientKey: 'legacy', name: 'Negro', attributes: { color: ' Negro ' }, sku: 'NEG', salePrice: 10, purchasePrice: null, stockQuantity: 7, minStock: 0, isActive: true }
it('previews retained/new/retired combinations without generating a Cartesian product', () => {
  const next = previewVariantCombinations([{ key: 'Color', label: 'Color', control: 'select', options: ['Negro', 'Blanco'] }], [v])
  expect(next).toMatchObject({ count: 2, preservedCount: 1, newCount: 1, impact: { variantsAffected: 0 } })
  const removed = previewVariantCombinations([{ key: 'color', label: 'Color', control: 'select', options: ['Blanco'] }], [v])
  expect(removed.impact).toMatchObject({ persistedVariantsAffected: 1, totalStockAffected: 7, requiresReview: true })
})

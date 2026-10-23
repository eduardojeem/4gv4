import { describe, expect, it } from 'vitest'
import { getVariantCombinationKey, analyzeVariantRemovalImpact } from './variant-safety'
import { generateVariantCombinations, mergeGeneratedVariants } from './variant-combinations'

const persisted = { id: '00000000-0000-4000-8000-000000000001', clientKey: 'old-order', name: 'Edited', attributes: { size: ' M ', color: 'Negro' }, sku: 'CUSTOM', purchasePrice: null, salePrice: 123, stockQuantity: 7, minStock: 2, isActive: false }
describe('variant safety', () => {
  it('has order/case/trim independent, unambiguous identity', () => {
    expect(getVariantCombinationKey({ Color: ' Negro ', Size: 'M' })).toBe(getVariantCombinationKey({ size: 'm', color: 'negro' }))
    expect(getVariantCombinationKey({ a: 'b|c=d' })).not.toBe(getVariantCombinationKey({ a: 'b', c: 'd' }))
  })
  it.each([null, 0, 12])('preserves persisted IDs and every edited field including cost %s', purchasePrice => {
    const old = { ...persisted, purchasePrice }
    const next = mergeGeneratedVariants(generateVariantCombinations([{ key: 'color', options: ['NEGRO'] }, { key: 'size', options: ['M', 'L'] }]), [old], { purchasePrice: 99, salePrice: 999 })
    expect(next[0]).toEqual(old)
    expect(next[1]).toMatchObject({ stockQuantity: 0, salePrice: 999, isActive: true })
    expect(next[1].id).toBeUndefined()
  })
  it('detects removal and reports stock/history uncertainty without querying', () => {
    const impact = analyzeVariantRemovalImpact([persisted], [], 'remove-value')
    expect(impact).toMatchObject({ variantsAffected: 1, persistedVariantsAffected: 1, totalStockAffected: 7, variantsWithStock: 1, requiresReview: true })
    expect(impact.variants[0]).toMatchObject({ id: persisted.id, persisted: true, active: false, hasHistory: null, reason: 'remove-value' })
    expect(analyzeVariantRemovalImpact([persisted], [persisted], 'regenerate').requiresReview).toBe(false)
  })
  it('allows removal only of unsaved drafts without stock', () => {
    expect(analyzeVariantRemovalImpact([{ ...persisted, id: undefined, stockQuantity: 0 }], [], 'simple').requiresReview).toBe(false)
    expect(analyzeVariantRemovalImpact([{ ...persisted, id: undefined }], [], 'simple').requiresReview).toBe(true)
  })
})

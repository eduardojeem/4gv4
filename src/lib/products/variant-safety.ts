import type { ProductVariantInput } from './variant-contract'

/** Identity is independent of visual order and escapes separators in user values. */
export function getVariantCombinationKey(attributes: Record<string, string>): string {
  return Object.entries(attributes)
    .map(([key, value]) => [key.trim().normalize('NFKC').toLowerCase(), value.trim().normalize('NFKC').toLowerCase()])
    .sort(([a, av], [b, bv]) => a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('|')
}

export function analyzeVariantRemovalImpact(
  existing: ProductVariantInput[],
  next: ProductVariantInput[],
  reason: string,
) {
  const ids = new Set(next.flatMap(v => v.id ? [v.id] : []))
  const keys = new Set(next.map(v => getVariantCombinationKey(v.attributes)))
  const variants = existing.filter(v => v.id ? !ids.has(v.id) : !keys.has(getVariantCombinationKey(v.attributes))).map(v => ({
    id: v.id ?? null,
    combination: v.name,
    persisted: Boolean(v.id),
    stockAffected: Math.max(0, v.stockQuantity),
    active: v.isActive,
    // Neither the editor nor its payload knows sales/history. Never assume none.
    hasHistory: null,
    reason,
  }))
  const persistedVariantsAffected = variants.filter(v => v.persisted).length
  const variantsWithStock = variants.filter(v => v.stockAffected > 0).length
  return {
    variants,
    variantsAffected: variants.length,
    persistedVariantsAffected,
    totalStockAffected: variants.reduce((sum, v) => sum + v.stockAffected, 0),
    variantsWithStock,
    requiresReview: persistedVariantsAffected > 0 || variantsWithStock > 0,
  }
}

export type VariantRemovalImpact = ReturnType<typeof analyzeVariantRemovalImpact>

import type { ProductAttributeDefinition, ProductVariantInput } from './variant-contract'
import { getVariantCombinationKey, analyzeVariantRemovalImpact } from './variant-safety'
import { countVariantCombinations, normalizeVariantAttributeText } from './variant-workflow'

export function previewVariantCombinations(attributes: ProductAttributeDefinition[], variants: ProductVariantInput[]) {
  const definitions = new Map(attributes.map(a => [normalizeVariantAttributeText(a.key), new Set(a.options.map(normalizeVariantAttributeText))]))
  const preserved = variants.filter(v => {
    const entries = Object.entries(v.attributes)
    return entries.length === definitions.size && entries.every(([key, value]) => definitions.get(normalizeVariantAttributeText(key))?.has(normalizeVariantAttributeText(value)))
  })
  const count = countVariantCombinations(attributes)
  const preservedCount = new Set(preserved.map(v => getVariantCombinationKey(v.attributes))).size
  return { count, preserved, preservedCount, newCount: Math.max(0, count - preservedCount), impact: analyzeVariantRemovalImpact(variants, preserved, 'regenerate') }
}

import type { ProductVariantInput } from './variant-contract'

export interface CombinationAttribute {
  key: string
  options: string[]
}

export interface GeneratedVariantCombination {
  key: string
  name: string
  attributes: Record<string, string>
}

export interface VariantPriceDefaults {
  purchasePrice: number
  salePrice: number
  wholesalePrice?: number
}

function uniqueOptions(options: string[]): string[] {
  const seen = new Set<string>()
  return options.reduce<string[]>((result, rawOption) => {
    const option = rawOption.trim()
    const normalized = option.toLocaleLowerCase()
    if (!option || seen.has(normalized)) return result
    seen.add(normalized)
    result.push(option)
    return result
  }, [])
}

export function generateVariantCombinations(
  definitions: CombinationAttribute[],
): GeneratedVariantCombination[] {
  const attributes = definitions
    .map((definition) => ({ key: definition.key.trim(), options: uniqueOptions(definition.options) }))
    .filter((definition) => definition.key && definition.options.length > 0)

  if (attributes.length === 0) return []

  return attributes.reduce<GeneratedVariantCombination[]>((combinations, definition) => {
    if (combinations.length === 0) {
      return definition.options.map((option) => ({
        key: `${definition.key}=${option}`,
        name: option,
        attributes: { [definition.key]: option },
      }))
    }

    return combinations.flatMap((combination) => definition.options.map((option) => ({
      key: `${combination.key}|${definition.key}=${option}`,
      name: `${combination.name} / ${option}`,
      attributes: { ...combination.attributes, [definition.key]: option },
    })))
  }, [])
}

export function mergeGeneratedVariants(
  generated: GeneratedVariantCombination[],
  previous: ProductVariantInput[],
  defaults: VariantPriceDefaults,
): ProductVariantInput[] {
  const previousByKey = new Map(previous.map((variant) => [variant.clientKey, variant]))

  return generated.map((combination) => previousByKey.get(combination.key) ?? {
    clientKey: combination.key,
    name: combination.name,
    attributes: combination.attributes,
    sku: '',
    purchasePrice: defaults.purchasePrice,
    salePrice: defaults.salePrice,
    wholesalePrice: defaults.wholesalePrice,
    minStock: 0,
    stockQuantity: 0,
    isActive: true,
  })
}

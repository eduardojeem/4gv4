import type { ProductAttributeDefinition } from './variant-contract'

export const VARIANT_COMBINATION_WARNING_THRESHOLD = 50
export const VARIANT_COMBINATION_HARD_CAP = 500

export function normalizeVariantAttributeText(value: string): string {
  return value.trim().normalize('NFKC').toLowerCase()
}

/** Counts canonical options without allocating the Cartesian product. */
export function countVariantCombinations(attributes: Pick<ProductAttributeDefinition, 'key' | 'options'>[]): number {
  if (attributes.length === 0) return 0
  let count = 1
  for (const attribute of attributes) {
    if (!normalizeVariantAttributeText(attribute.key)) return 0
    const options = new Set(attribute.options.map(normalizeVariantAttributeText).filter(Boolean))
    if (options.size === 0) return 0
    count = Math.min(Number.MAX_SAFE_INTEGER, count * options.size)
  }
  return count
}

export function validateVariantAttributes(attributes: ProductAttributeDefinition[]): string[] {
  const errors: string[] = []
  const labels = new Set<string>()
  const keys = new Set<string>()
  if (!attributes.length) errors.push('Agregá al menos un atributo.')
  for (const attribute of attributes) {
    const label = normalizeVariantAttributeText(attribute.label)
    const key = normalizeVariantAttributeText(attribute.key)
    if (!label) errors.push('El nombre del atributo es obligatorio.')
    else if (labels.has(label)) errors.push(`El atributo «${attribute.label.trim()}» está duplicado.`)
    labels.add(label)
    if (!key || keys.has(key)) errors.push('Cada atributo debe tener una clave única.')
    keys.add(key)
    const options = attribute.options.map(normalizeVariantAttributeText).filter(Boolean)
    if (!options.length) errors.push(`Agregá al menos un valor para ${attribute.label.trim() || 'el atributo'}.`)
    if (options.length !== attribute.options.length) errors.push('Los valores no pueden estar vacíos.')
    if (new Set(options).size !== options.length) errors.push(`Hay valores duplicados en ${attribute.label.trim() || 'el atributo'}.`)
  }
  return errors
}

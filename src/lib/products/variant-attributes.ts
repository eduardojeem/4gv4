import type { VariantAttributeValue } from '@/types/product-variants'

const NON_SELECTABLE_ATTRIBUTE_KEYS = new Set(['image_url'])

export function normalizeVariantAttributeValues(value: unknown): VariantAttributeValue[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []
      const item = entry as Record<string, unknown>
      const attributeName = String(item.attribute_name ?? item.name ?? item.attribute_id ?? '').trim()
      const attributeId = String(item.attribute_id ?? attributeName).trim()
      const rawValue = String(item.value ?? item.display_value ?? '').trim()
      const optionId = String(item.option_id ?? rawValue).trim()
      if (!attributeId || !rawValue || NON_SELECTABLE_ATTRIBUTE_KEYS.has(attributeId.toLowerCase())) return []

      return [{
        attribute_id: attributeId,
        attribute_name: attributeName || attributeId,
        option_id: optionId || rawValue,
        value: rawValue,
        display_value: item.display_value ? String(item.display_value) : undefined,
        color_hex: item.color_hex ? String(item.color_hex) : undefined,
      }]
    })
  }

  if (!value || typeof value !== 'object') return []

  return Object.entries(value as Record<string, unknown>).flatMap(([key, rawValue]) => {
    const attributeId = key.trim()
    const optionValue = rawValue == null ? '' : String(rawValue).trim()
    if (!attributeId || !optionValue || NON_SELECTABLE_ATTRIBUTE_KEYS.has(attributeId.toLowerCase())) return []

    return [{
      attribute_id: attributeId,
      attribute_name: attributeId,
      option_id: optionValue,
      value: optionValue,
      display_value: optionValue,
    }]
  })
}

export function deriveVariantAttributeConfig(
  variants: Array<{ attributes?: unknown }>,
): Array<{ key: string; label: string; control: 'color' | 'select'; options: string[] }> {
  const valuesByKey = new Map<string, Set<string>>()

  for (const variant of variants) {
    if (!variant.attributes || typeof variant.attributes !== 'object' || Array.isArray(variant.attributes)) continue
    for (const [rawKey, rawValue] of Object.entries(variant.attributes as Record<string, unknown>)) {
      const key = rawKey.trim()
      const value = rawValue == null ? '' : String(rawValue).trim()
      if (!key || !value || NON_SELECTABLE_ATTRIBUTE_KEYS.has(key.toLowerCase())) continue
      const values = valuesByKey.get(key) ?? new Set<string>()
      values.add(value)
      valuesByKey.set(key, values)
    }
  }

  const rank = (key: string) => key.toLowerCase().includes('color')
    ? 0
    : ['size', 'talle', 'talla'].includes(key.toLowerCase()) ? 1 : 2

  return Array.from(valuesByKey.entries())
    .sort(([left], [right]) => rank(left) - rank(right))
    .map(([key, values]) => ({
      key,
      label: ['size', 'talle'].includes(key.toLowerCase())
        ? 'Talle'
        : key.toLowerCase() === 'talla'
          ? 'Talla'
          : key.charAt(0).toUpperCase() + key.slice(1),
      control: key.toLowerCase().includes('color') ? 'color' : 'select',
      options: Array.from(values),
    }))
}

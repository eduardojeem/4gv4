export const FASHION_AUDIENCES = [
  { value: 'mujer', label: 'Mujer' },
  { value: 'hombre', label: 'Hombre' },
  { value: 'ninos', label: 'Niños' },
  { value: 'bebes', label: 'Bebés' },
  { value: 'unisex', label: 'Unisex' },
] as const

export type FashionAudience = (typeof FASHION_AUDIENCES)[number]['value']

const AUDIENCE_PREFIX = 'audience:'

export function getFashionAudienceFromTags(tags?: string[] | null): FashionAudience | '' {
  const value = tags
    ?.find((tag) => tag.toLowerCase().startsWith(AUDIENCE_PREFIX))
    ?.slice(AUDIENCE_PREFIX.length)
    .toLowerCase()

  return FASHION_AUDIENCES.some((option) => option.value === value)
    ? (value as FashionAudience)
    : ''
}

export function mergeFashionAudienceTag(
  tags: string[] | null | undefined,
  audience: FashionAudience | '',
): string[] {
  const preserved = (tags ?? []).filter(
    (tag) => !tag.toLowerCase().startsWith(AUDIENCE_PREFIX),
  )
  return audience ? [...preserved, `${AUDIENCE_PREFIX}${audience}`] : preserved
}

const FASHION_ATTRIBUTE_KEYS = {
  size: ['size', 'talle', 'talla'],
  color: ['color', 'colour'],
} as const

export function getVariantFashionValue(
  attributes: Record<string, unknown> | null | undefined,
  facet: keyof typeof FASHION_ATTRIBUTE_KEYS,
): string {
  if (!attributes) return ''
  const acceptedKeys = FASHION_ATTRIBUTE_KEYS[facet]
  const entry = Object.entries(attributes).find(([key]) =>
    acceptedKeys.some((acceptedKey) => acceptedKey === key.trim().toLowerCase()),
  )
  return typeof entry?.[1] === 'string' ? entry[1].trim() : ''
}

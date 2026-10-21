/** Omission preserves server costs; zero is an explicit write and must remain distinct. */
export function omitUnauthorizedProductCosts<T extends Record<string, unknown>>(payload: T, canUpdateCost: boolean): T {
  if (canUpdateCost) return payload
  const costFields = new Set(['purchase_price', 'purchasePrice', 'foreign_purchase_price', 'cost_price'])
  const strip = (value: Record<string, unknown>) => Object.fromEntries(Object.entries(value).filter(([key]) => !costFields.has(key)))
  const result = strip(payload)
  if (Array.isArray(payload.variants)) result.variants = payload.variants.map(variant =>
    variant && typeof variant === 'object' ? strip(variant as Record<string, unknown>) : variant)
  return result as T
}

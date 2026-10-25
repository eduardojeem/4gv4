/** Unknown cost must not fall through Number(null) or inherit another price. */
export function getVariantPurchaseCost(value: unknown): number | null {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, number) : null
}

/** Prefer the canonical field even when explicitly null. Omission remains omission. */
export function getVariantCostValue(input: Record<string, unknown>): unknown {
  return input.purchase_price !== undefined ? input.purchase_price : input.cost_price
}

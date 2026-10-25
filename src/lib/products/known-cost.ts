/** Null means unavailable; zero is a known, legitimate cost. */
export function knownCost(value: unknown): number | null {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '') || typeof value === 'boolean') return null
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}
/** A total is unknown when even one contributing cost is unavailable. */
export function costTotal(values: ReadonlyArray<number | null | undefined>): number | null {
  let total = 0
  for (const value of values) {
    const cost = knownCost(value)
    if (cost === null) return null
    total += cost
  }
  return total
}
export function costProfit(revenue: number, cost: number | null): number | null {
  return cost === null ? null : revenue - cost
}
export function costMargin(revenue: number, cost: number | null): number | null {
  const profit = costProfit(revenue, cost)
  return profit === null ? null : revenue > 0 ? profit / revenue * 100 : 0
}
export function formatKnownCost(value: number | null | undefined, fractionDigits?: number): string {
  return value === null || value === undefined ? '—' : value.toLocaleString('es-PY', fractionDigits === undefined ? undefined : { maximumFractionDigits: fractionDigits })
}

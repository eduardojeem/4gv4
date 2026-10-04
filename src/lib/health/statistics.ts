function finiteSorted(values: number[]): number[] {
  return values.filter(Number.isFinite).sort((left, right) => left - right)
}

export function median(values: number[]): number | null {
  const sorted = finiteSorted(values)
  if (sorted.length === 0) return null

  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

export function percentile(values: number[], requestedPercentile: number): number | null {
  const sorted = finiteSorted(values)
  if (sorted.length === 0) return null

  const bounded = Math.min(Math.max(requestedPercentile, 0), 100)
  const rank = Math.max(1, Math.ceil((bounded / 100) * sorted.length))
  return sorted[rank - 1]
}

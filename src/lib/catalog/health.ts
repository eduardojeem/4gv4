export type CatalogHealth = 'healthy' | 'warning' | 'error' | 'unknown'

export function catalogHealth(
  evidence: Array<number | null>,
  options: { pending?: number | null; error?: boolean } = {},
): CatalogHealth {
  if (options.error) return 'error'
  if (evidence.some((value) => value === null) || options.pending === null) return 'unknown'
  if ((options.pending ?? 0) > 0) return 'warning'
  return 'healthy'
}

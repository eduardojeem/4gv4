export type BulkCatalogFailure = { id: string; reason: string }

export type BulkCatalogResult = {
  requested: number
  created: number
  updated: number
  linked: number
  skipped: number
  failed: BulkCatalogFailure[]
}

const isCount = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0

export function isBulkCatalogResult(value: unknown): value is BulkCatalogResult {
  if (!value || typeof value !== 'object') return false
  const result = value as Record<string, unknown>
  return ['requested', 'created', 'updated', 'linked', 'skipped'].every((key) => isCount(result[key]))
    && Array.isArray(result.failed)
    && result.failed.every((failure) => Boolean(failure)
      && typeof failure === 'object'
      && typeof (failure as Record<string, unknown>).id === 'string'
      && typeof (failure as Record<string, unknown>).reason === 'string')
}

export function bulkResultSucceeded(result: BulkCatalogResult): boolean {
  return result.failed.length === 0
}

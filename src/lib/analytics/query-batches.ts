export function chunkQueryValues<T>(values: T[], batchSize = 500): T[][] {
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error('batchSize must be a positive integer')
  }

  const chunks: T[][] = []
  for (let index = 0; index < values.length; index += batchSize) {
    chunks.push(values.slice(index, index + batchSize))
  }
  return chunks
}

/** Lo mínimo de una consulta de Supabase que se puede paginar. */
type QueryError = { message: string; code?: string }
type PageableQuery<T> = { range(from: number, to: number): PromiseLike<{ data: T[] | null; error: QueryError | null }> }

export type AllPagesResult<T> = { data: T[]; error: QueryError | null; truncated: boolean }

/**
 * Trae todas las filas de una consulta, de a `pageSize`. Supabase devuelve como
 * máximo 1000 filas por pedido: sin esto, un período con muchas ventas o
 * movimientos se cortaba sin aviso y los totales salían más bajos.
 * `makeQuery` debe devolver una consulta nueva (con orden estable) en cada página.
 * Con más de `maxRows` se detiene y avisa con `truncated`.
 */
export async function fetchAllPages<T>(
  makeQuery: () => PageableQuery<T>,
  { pageSize = 1000, maxRows = 50000 }: { pageSize?: number; maxRows?: number } = {},
): Promise<AllPagesResult<T>> {
  const rows: T[] = []
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const { data, error } = await makeQuery().range(offset, offset + pageSize - 1)
    if (error) return { data: rows, error, truncated: false }
    const page = data ?? []
    rows.push(...page)
    if (page.length < pageSize) return { data: rows, error: null, truncated: false }
  }
  return { data: rows, error: null, truncated: true }
}

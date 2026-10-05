type PageResult<T> = PromiseLike<{
  data: T[] | null
  error: { message: string } | null
}>

/**
 * Recorre una consulta por páginas: Supabase devuelve como mucho 1000 filas por
 * pedido. Con `maxRows` deja de pedir al llegar a ese tope.
 */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PageResult<T>,
  pageSize = 1000,
  maxRows = Number.POSITIVE_INFINITY,
): Promise<T[]> {
  const rows: T[] = []

  for (let from = 0; rows.length < maxRows; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1)
    if (error) throw new Error(error.message)

    const page = data ?? []
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
  return rows.slice(0, maxRows)
}

export function chunkValues<T>(values: T[], size = 200): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }
  return chunks
}

type PageResult<T> = PromiseLike<{
  data: T[] | null
  error: { message: string } | null
}>

export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PageResult<T>,
  pageSize = 1000
): Promise<T[]> {
  const rows: T[] = []

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1)
    if (error) throw new Error(error.message)

    const page = data ?? []
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}

export function chunkValues<T>(values: T[], size = 200): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }
  return chunks
}

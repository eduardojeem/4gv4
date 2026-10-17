type QueryResult<Row> = { data: Row[] | null; error: unknown; count: number | null }
type CompleteQuery<Row> = PromiseLike<QueryResult<Row>> & {
 range: (from: number, to: number) => CompleteQuery<Row>
 order: (column: string, options?: { ascending?: boolean }) => CompleteQuery<Row>
 abortSignal: (signal: AbortSignal) => CompleteQuery<Row>
}

/** Exact coverage is mandatory: never report a truncated page as a dashboard total. */
export async function completeDashboardQuery<Row>(query: CompleteQuery<Row>, signal?: AbortSignal): Promise<QueryResult<Row>> {
 const rows: Row[] = []
 let expected: number | null = null
 const ids = new Set<string>()
 try {
  query = query.order('id', { ascending: true })
  if (signal) query = query.abortSignal(signal)
  while (true) {
   if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
   const result = await query.range(rows.length, rows.length + 499)
   if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
   if (result.error) return { data: null, error: result.error, count: null }
   if (!result.data || result.count === null || !Number.isInteger(result.count) || result.count < 0) throw new Error('No se pudo verificar la cobertura completa de los datos.')
   if (expected !== null && result.count !== expected) throw new Error('Los datos cambiaron durante la carga. Reintentá.')
   expected = result.count
   for (const row of result.data) {
    const id = (row as { id?: unknown } | null)?.id
    if (typeof id === 'string') {
     if (ids.has(id)) throw new Error('La lista cambió durante la carga. Reintentá.')
     ids.add(id)
    }
   }
   rows.push(...result.data)
   if (rows.length === expected) return { data: rows, error: null, count: expected }
   if (!result.data.length || rows.length > expected) throw new Error('La respuesta está incompleta. Reintentá.')
  }
 } catch (error) { return { data: null, error, count: null } }
}

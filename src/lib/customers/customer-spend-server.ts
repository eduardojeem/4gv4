import { aggregateCustomerSpend, type CustomerSpendMetrics, type SpendRow } from '@/lib/customers/customer-spend'

/**
 * Lo gastado por varios clientes a la vez, calculado en el servidor.
 *
 * La lista lo calculaba en el navegador con tres consultas `.in(customer_id)`:
 * - Supabase corta cada consulta en 1000 filas, así que con más operaciones el
 *   total quedaba recortado sin aviso.
 * - Mandaba todos los IDs en la URL; con 182 clientes ya eran unos 7 KB.
 * - No filtraba por organización ni excluía ventas anuladas.
 *
 * Acá se parte en tandas de IDs, se pagina cada consulta y todo se acota a la
 * empresa. La regla de qué cuenta es la de `aggregateCustomerSpend`.
 */

const ID_CHUNK = 150
const PAGE_SIZE = 1000

type Row = Record<string, unknown>
type QueryResult = { data: Row[] | null; error: { message?: string } | null }

type QueryBuilder = PromiseLike<QueryResult> & {
  select: (columns: string) => QueryBuilder
  eq: (column: string, value: unknown) => QueryBuilder
  in: (column: string, values: unknown[]) => QueryBuilder
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder
  range: (from: number, to: number) => QueryBuilder
}

export type SpendClient = { from: (table: string) => unknown }

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Todas las filas de una consulta, página por página. */
async function readAll(
  client: SpendClient,
  table: string,
  columns: string,
  organizationId: string,
  ids: string[],
): Promise<Row[]> {
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await (client.from(table) as QueryBuilder)
      .select(columns)
      .eq('organization_id', organizationId)
      .in('customer_id', ids)
      // Orden estable: sin él, paginar podía repetir o saltear filas.
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error(`No se pudo leer ${table}: ${error.message ?? 'error desconocido'}`)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}

export async function loadCustomerSpend(
  client: SpendClient,
  organizationId: string,
  customerIds: string[],
  now: Date = new Date(),
): Promise<Record<string, CustomerSpendMetrics>> {
  const ids = [...new Set(customerIds.filter(Boolean))]
  if (ids.length === 0) return {}

  const sales: SpendRow[] = []
  const orders: SpendRow[] = []
  const repairs: SpendRow[] = []

  for (const part of chunk(ids, ID_CHUNK)) {
    const [saleRows, orderRows, repairRows] = await Promise.all([
      readAll(client, 'sales', 'id, customer_id, total_amount, status, created_at', organizationId, part),
      readAll(client, 'customer_orders', 'id, customer_id, total, status, created_at', organizationId, part),
      readAll(client, 'repairs', 'id, customer_id, final_cost, estimated_cost, status, created_at', organizationId, part),
    ])

    for (const row of saleRows) {
      sales.push({ customer_id: row.customer_id as string, amount: row.total_amount as number, date: row.created_at as string, status: row.status as string })
    }
    for (const row of orderRows) {
      orders.push({ customer_id: row.customer_id as string, amount: row.total as number, date: row.created_at as string, status: row.status as string })
    }
    for (const row of repairRows) {
      repairs.push({
        customer_id: row.customer_id as string,
        // El mismo criterio que usa la ficha de reparaciones (/api/customers/[id]/metrics).
        amount: (row.final_cost ?? row.estimated_cost) as number,
        date: row.created_at as string,
        status: row.status as string,
      })
    }
  }

  return aggregateCustomerSpend({ sales, orders, repairs }, now)
}

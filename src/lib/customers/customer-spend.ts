/**
 * Total gastado por cliente para las listas (tabla y tarjetas).
 *
 * Antes se calculaba solo con la tabla `sales`, o sea unicamente las ventas
 * hechas en el POS. Un cliente que compro por la tienda publica (que guarda en
 * `customer_orders`) o que pago una reparacion aparecia con Gs. 0, aunque su
 * ficha de detalle si contara esas operaciones. De ahi que el total apareciera
 * "solo en algunos casos".
 */

export type CustomerSpendMetrics = {
  /** Cantidad total de operaciones contadas. */
  count: number
  /** Compras: ventas del POS + pedidos de la tienda publica. */
  purchaseCount: number
  /** Reparaciones terminadas. Se lleva aparte porque la tarjeta las muestra
   *  como columna propia, y sumarlas a `count` las contaba dos veces. */
  repairCount: number
  /** Total gastado. */
  total: number
  /** Importe de la operacion mas reciente. */
  lastAmount: number
  /** Fecha de la operacion mas reciente. */
  lastDate: string | null
}

export type SpendRow = {
  customer_id?: string | null
  amount?: number | string | null
  date?: string | null
  status?: string | null
}

export type SpendSources = {
  /** Ventas del POS. Todas cuentan: son operaciones ya cerradas. */
  sales?: SpendRow[] | null
  /** Pedidos de la tienda publica. Los cancelados no cuentan. */
  orders?: SpendRow[] | null
  /** Reparaciones. Solo las terminadas: una en curso todavia no se pago. */
  repairs?: SpendRow[] | null
}

function toAmount(value: unknown): number {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

/** Un pedido cancelado no es plata gastada. */
export function isCountableOrder(status: string | null | undefined) {
  const normalized = String(status ?? '').trim().toUpperCase()
  return normalized !== 'CANCELLED' && normalized !== 'CANCELADO'
}

/**
 * Solo suma reparaciones terminadas. Una en curso puede cambiar de precio o
 * cancelarse, y contarla como gastada infla el total del cliente.
 *
 * La columna `repairs.status` guarda los estados en espanol ('listo',
 * 'entregado', 'cancelado'). Se aceptan tambien los equivalentes en ingles
 * porque hay una capa de mapeo (stageToStatus) que normaliza a 'completed',
 * y filtrar por un solo vocabulario haria que no se sume ninguna reparacion.
 */
const COMPLETED_REPAIR_STATUSES = new Set([
  'listo',
  'entregado',
  'completed',
  'delivered',
])

export function isCountableRepair(status: string | null | undefined) {
  return COMPLETED_REPAIR_STATUSES.has(String(status ?? '').trim().toLowerCase())
}

function addRow(
  target: Record<string, CustomerSpendMetrics>,
  row: SpendRow,
  kind: 'purchase' | 'repair',
) {
  const customerId = String(row.customer_id ?? '').trim()
  if (!customerId) return

  const amount = toAmount(row.amount)
  const date = row.date ?? null
  const current = target[customerId]

  if (!current) {
    target[customerId] = {
      count: 1,
      purchaseCount: kind === 'purchase' ? 1 : 0,
      repairCount: kind === 'repair' ? 1 : 0,
      total: amount,
      lastAmount: amount,
      lastDate: date,
    }
    return
  }

  current.count += 1
  if (kind === 'purchase') current.purchaseCount += 1
  else current.repairCount += 1
  current.total += amount

  // La operacion mas reciente puede venir de cualquiera de las tres fuentes,
  // asi que se compara por fecha en vez de confiar en el orden de la consulta.
  const isNewer = Boolean(date) && (!current.lastDate || date! > current.lastDate)
  if (isNewer) {
    current.lastDate = date
    current.lastAmount = amount
  }
}

export function aggregateCustomerSpend(sources: SpendSources): Record<string, CustomerSpendMetrics> {
  const result: Record<string, CustomerSpendMetrics> = {}

  for (const row of sources.sales ?? []) {
    addRow(result, row, 'purchase')
  }
  for (const row of sources.orders ?? []) {
    if (isCountableOrder(row.status)) addRow(result, row, 'purchase')
  }
  for (const row of sources.repairs ?? []) {
    if (isCountableRepair(row.status)) addRow(result, row, 'repair')
  }

  return result
}

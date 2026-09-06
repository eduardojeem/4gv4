/**
 * Cifras de un turno de caja, resolviendo el choque entre lo que quedo guardado
 * en `cash_closures` y lo que suman sus movimientos.
 *
 * Dos cosas que estaban mal en el monitor:
 *
 * 1. Se preguntaba `columnaDb > 0 ? columnaDb : calculadoDeMovimientos`. Un
 *    turno sin ventas vale cero, y cero es un dato: se lo trataba como columna
 *    vacia y se lo reemplazaba por lo calculado. Si la base decia 0 y los
 *    movimientos sumaban 500.000, la pantalla mostraba 500.000 y tapaba justo la
 *    contradiccion que un arqueo tiene que sacar a la luz.
 *
 * 2. `expected_balance` usaba `Number(...) || balanceCalculado`. Una caja que se
 *    espera en cero —todo retirado— caia en el calculado y el arqueo comparaba
 *    contra otra cosa.
 */

export interface SessionMovementTotals {
  /** Cuantos movimientos tiene el turno. Cero significa que no hay con que comparar. */
  total: number
  totalSales: number
  salesCash: number
  salesCard: number
  salesTransfer: number
  salesMixed: number
  cashIn: number
  cashOut: number
}

export interface SessionRow {
  total_sales?: unknown
  sales_total?: unknown
  sales_total_cash?: unknown
  sales_total_card?: unknown
  sales_total_transfer?: unknown
  sales_total_mixed?: unknown
  income_total?: unknown
  expense_total?: unknown
  opening_balance?: unknown
  closing_balance?: unknown
  expected_balance?: unknown
}

export interface SessionFigures {
  totalSales: number
  salesCash: number
  salesCard: number
  salesTransfer: number
  salesMixed: number
  openingBalance: number
  incomeTotal: number
  expenseTotal: number
  currentBalance: number
  expectedBalance: number
  /**
   * La base y los movimientos no dicen lo mismo sobre las ventas del turno.
   * Manda lo guardado, pero la diferencia se expone: es un hallazgo, no ruido.
   */
  salesMismatch: number | null
}

/** Un numero cargado, o `null` si la columna esta vacia. Cero es un numero. */
export function storedNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function firstStored(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = storedNumber(value)
    if (parsed !== null) return parsed
  }
  return null
}

export function calculateSessionFigures(
  row: SessionRow,
  movements: SessionMovementTotals
): SessionFigures {
  const salesCash = storedNumber(row.sales_total_cash) ?? movements.salesCash
  const salesCard = storedNumber(row.sales_total_card) ?? movements.salesCard
  const salesTransfer = storedNumber(row.sales_total_transfer) ?? movements.salesTransfer
  const salesMixed = storedNumber(row.sales_total_mixed) ?? movements.salesMixed

  const storedSales = firstStored(row.total_sales, row.sales_total)
  const totalSales = storedSales ?? (
    movements.total > 0 ? movements.totalSales : salesCash + salesCard + salesTransfer + salesMixed
  )

  const openingBalance = storedNumber(row.opening_balance) ?? 0
  const incomeTotal = storedNumber(row.income_total) ?? movements.cashIn
  const expenseTotal = storedNumber(row.expense_total) ?? movements.cashOut

  const closingBalance = storedNumber(row.closing_balance)
  const currentBalance = closingBalance ?? (openingBalance + totalSales + incomeTotal - expenseTotal)

  // Solo tiene sentido comparar cuando hay las dos cosas.
  const salesMismatch =
    storedSales !== null && movements.total > 0 && storedSales !== movements.totalSales
      ? movements.totalSales - storedSales
      : null

  return {
    totalSales,
    salesCash,
    salesCard,
    salesTransfer,
    salesMixed,
    openingBalance,
    incomeTotal,
    expenseTotal,
    currentBalance,
    expectedBalance: storedNumber(row.expected_balance) ?? currentBalance,
    salesMismatch,
  }
}

/**
 * Cuanto lleva abierto un turno, en horas.
 *
 * Abierto es «sin fecha de cierre», que es como lo definen la consulta y el
 * estado que muestra la tabla. El codigo anterior preguntaba por el `status`
 * crudo de la fila, que la apertura no escribe —la RPC inserta sin tocarlo—:
 * ninguna caja abierta mostraba cuanto llevaba abierta, que es lo primero que un
 * monitor de cajas tiene que decir.
 */
export function openDurationHours(
  row: { date?: unknown; created_at?: unknown },
  now: Date = new Date()
): number | undefined {
  if (row.date) return undefined

  const openedAt = new Date(String(row.created_at ?? ''))
  const openedMs = openedAt.getTime()
  if (!Number.isFinite(openedMs)) return undefined

  const hours = (now.getTime() - openedMs) / (1000 * 60 * 60)
  return Math.round(Math.max(0, hours) * 10) / 10
}

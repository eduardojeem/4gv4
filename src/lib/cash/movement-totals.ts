import { normalizeCashMovementType } from '@/app/dashboard/pos/types'

/**
 * Medio de pago de un movimiento de caja en una sola forma. Un trigger pasa
 * `payment_method` al español (`efectivo`, `tarjeta`, `transferencia`): quien
 * comparaba contra `card`/`transfer` veía siempre 0 en tarjeta y transferencia.
 */
export type CashMovementMethod = 'cash' | 'card' | 'transfer' | 'mixed' | 'other'

export function normalizeCashMovementMethod(method: string | null | undefined): CashMovementMethod {
  switch (String(method ?? '').trim().toLowerCase()) {
    case '':
    case 'cash':
    case 'efectivo':
      return 'cash'
    case 'card':
    case 'tarjeta':
      return 'card'
    case 'transfer':
    case 'transferencia':
    case 'qr':
      return 'transfer'
    case 'mixed':
    case 'mixto':
      return 'mixed'
    default:
      return 'other'
  }
}

export interface CashMovementRow {
  id?: string | null
  type?: string | null
  amount?: number | string | null
  payment_method?: string | null
  sale_id?: string | null
}

export interface CashMovementTotals {
  /** Cuántos movimientos tiene el turno. */
  total: number
  /** Ventas distintas (una venta mixta trae un movimiento por medio). */
  salesCount: number
  totalSales: number
  salesCash: number
  salesCard: number
  salesTransfer: number
  salesMixed: number
  cashIn: number
  cashOut: number
}

/** Totales de un turno sumados desde sus movimientos. */
export function summarizeCashMovements(rows: CashMovementRow[]): CashMovementTotals {
  const totals: CashMovementTotals = {
    total: 0, salesCount: 0, totalSales: 0, salesCash: 0, salesCard: 0, salesTransfer: 0, salesMixed: 0, cashIn: 0, cashOut: 0,
  }
  const sales = new Set<string>()
  for (const row of rows) {
    const amount = Number(row.amount) || 0
    totals.total++
    const type = normalizeCashMovementType(row.type)
    if (type === 'sale') {
      totals.totalSales += amount
      sales.add(String(row.sale_id ?? row.id ?? totals.total))
      const method = normalizeCashMovementMethod(row.payment_method)
      if (method === 'cash') totals.salesCash += amount
      else if (method === 'card') totals.salesCard += amount
      else if (method === 'transfer') totals.salesTransfer += amount
      else if (method === 'mixed') totals.salesMixed += amount
    } else if (type === 'cash_in') {
      totals.cashIn += amount
    } else if (type === 'cash_out') {
      totals.cashOut += amount
    }
  }
  totals.salesCount = sales.size
  return totals
}

import { format, parseISO } from 'date-fns'
import type { DateRange } from 'react-day-picker'

/**
 * Exportacion de las ventas del periodo.
 *
 * El boton «Exportar CSV» exportaba `recentSales`: las 10 ventas mas recientes,
 * no las del periodo filtrado. Ademas leia `customer_name` e `items_count`,
 * campos que esas filas no tenian, asi que las columnas Cliente e Items salian
 * «undefined» en cada fila, y los importes iban formateados («₲ 50.000»), con
 * lo que la planilla no los podia sumar.
 *
 * Ahora se exporta lo mismo que muestra la tabla detallada del periodo.
 */
export interface ExportableSale {
  id: string
  code?: string | null
  created_at: string
  customer?: { name?: string | null } | null
  payment_method?: string | null
  itemsCount?: number | null
  total?: number | null
  cost?: number | null
  refundAmount?: number | null
  profit?: number | null
}

export const SALES_CSV_HEADERS = [
  'Código',
  'Fecha',
  'Cliente',
  'Método de pago',
  'Artículos',
  'Total',
  'Costo',
  'Devolución',
  'Ganancia',
] as const

const celda = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
const importe = (value: number | null | undefined) => Math.round(Number(value) || 0)

export function buildSalesCsv(sales: readonly ExportableSale[]): string {
  const filas = sales.map((sale) => [
    sale.code || sale.id.substring(0, 8).toUpperCase(),
    format(parseISO(sale.created_at), 'dd/MM/yyyy HH:mm'),
    sale.customer?.name || 'Consumidor Final',
    sale.payment_method ?? '',
    sale.itemsCount ?? '',
    importe(sale.total),
    importe(sale.cost),
    importe(sale.refundAmount),
    importe(sale.profit),
  ])

  return [SALES_CSV_HEADERS, ...filas].map((fila) => fila.map(celda).join(',')).join('\r\n')
}

/** El nombre dice que periodo trae el archivo, no el dia en que se descargo. */
export function salesCsvFileName(range: DateRange | undefined, now: Date = new Date()): string {
  const desde = range?.from ?? now
  const hasta = range?.to ?? desde
  const d = format(desde, 'yyyy-MM-dd')
  const h = format(hasta, 'yyyy-MM-dd')
  return d === h ? `ventas_pos_${d}.csv` : `ventas_pos_${d}_a_${h}.csv`
}

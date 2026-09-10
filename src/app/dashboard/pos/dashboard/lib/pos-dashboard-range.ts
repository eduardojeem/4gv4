import { eachDayOfInterval, endOfDay, format, isSameDay, parseISO, startOfDay, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'

/**
 * El rango de fechas del dashboard del POS y lo que se calcula a partir de el.
 *
 * Vivia repartido entre el encabezado (los rangos rapidos, sin forma de saber
 * cual estaba aplicado) y el hook (los limites del dia y el grafico diario,
 * que agrupaba por «dia/mes» sin el año y mezclaba el 10/09 de dos años
 * distintos en la misma barra).
 */

export type QuickRangeKey = 'today' | 'last7' | 'last30' | 'thisMonth'

export const QUICK_RANGES: ReadonlyArray<{ key: QuickRangeKey; label: string; getRange: (now: Date) => DateRange }> = [
  { key: 'today', label: 'Hoy', getRange: (now) => ({ from: now, to: now }) },
  { key: 'last7', label: '7 días', getRange: (now) => ({ from: subDays(now, 6), to: now }) },
  { key: 'last30', label: '30 días', getRange: (now) => ({ from: subDays(now, 29), to: now }) },
  { key: 'thisMonth', label: 'Este mes', getRange: (now) => ({ from: new Date(now.getFullYear(), now.getMonth(), 1), to: now }) },
]

/**
 * Cual rango rapido corresponde al rango aplicado. Los botones no mostraban
 * ninguno activo: despues de tocar «7 días» no habia forma de confirmar que el
 * filtro se habia aplicado salvo leyendo las fechas del calendario.
 */
export function activeQuickRange(range: DateRange | undefined, now: Date = new Date()): QuickRangeKey | null {
  if (!range?.from) return null
  const to = range.to ?? range.from
  const match = QUICK_RANGES.find((quick) => {
    const candidate = quick.getRange(now)
    return isSameDay(candidate.from!, range.from!) && isSameDay(candidate.to ?? candidate.from!, to)
  })
  return match?.key ?? null
}

/**
 * Inicio y fin del dia local. Es el mismo criterio para todas las consultas del
 * dashboard: si una usara otro, las cifras de dos tarjetas del mismo periodo no
 * coincidirian.
 */
export function rangeBounds(range: DateRange | undefined): { from: string; to: string } | null {
  if (!range?.from) return null
  return {
    from: startOfDay(range.from).toISOString(),
    to: endOfDay(range.to ?? range.from).toISOString(),
  }
}

export interface DailySalesPoint {
  date: string
  fullDate: string
  sales: number
  transactions: number
}

/**
 * Ventas por dia, con los dias sin ventas en cero. La clave interna lleva el
 * año; la etiqueta tambien, pero solo cuando el rango cruza de un año a otro.
 */
export function buildDailySales(
  range: DateRange,
  sales: ReadonlyArray<{ created_at: string; total?: number | null }>
): DailySalesPoint[] {
  const days = eachDayOfInterval({ start: startOfDay(range.from!), end: startOfDay(range.to ?? range.from!) })
  const cruzaAnios = days.length > 0 && days[0].getFullYear() !== days[days.length - 1].getFullYear()
  const etiqueta = cruzaAnios ? 'dd/MM/yy' : 'dd/MM'

  const porDia = new Map<string, DailySalesPoint>()
  for (const day of days) {
    porDia.set(format(day, 'yyyy-MM-dd'), {
      date: format(day, etiqueta),
      fullDate: format(day, 'EEEE dd/MM/yyyy', { locale: es }),
      sales: 0,
      transactions: 0,
    })
  }

  for (const sale of sales) {
    const punto = porDia.get(format(parseISO(sale.created_at), 'yyyy-MM-dd'))
    if (!punto) continue
    punto.sales += Number(sale.total) || 0
    punto.transactions += 1
  }

  return [...porDia.values()]
}

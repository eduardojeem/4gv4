import type { FinanceSummary } from './types'

/**
 * El número grande de Finanzas: cuánto ganaste.
 *
 * El servidor no calcula la ganancia neta si a alguna venta le falta el costo,
 * y en un comercio chico eso pasa casi siempre. En vez de mostrar «Pendiente»
 * (que no responde «¿me fue bien?»), se estima con lo que hay y se marca como
 * aproximada: sale más alta de lo real, porque esas ventas cuentan sin costo.
 * Es la misma regla que usa la app (`mobile/src/lib/finance-model.ts`).
 */
export function financeHeadline(accrued: FinanceSummary['accrued']) {
  const { revenue, directCosts, operatingExpenses, payrollCost, netProfit } = accrued
  const exact = netProfit !== null && Number.isFinite(netProfit)
  const profit = exact ? netProfit : revenue - directCosts - operatingExpenses - payrollCost
  return {
    profit,
    estimated: !exact,
    /** Cuánto queda de cada 100 vendidos; sin ventas no hay margen. */
    marginPct: revenue > 0 ? Math.round((profit / revenue) * 100) : null,
  }
}

/**
 * «+15 % que el período anterior», en palabras. Sin base de comparación
 * (anterior en cero o sin dato) no se inventa un porcentaje.
 */
export function comparisonText(current: number | null, previous: number | null | undefined): string | null {
  if (current === null || previous === null || previous === undefined) return null
  if (previous === 0) return current === 0 ? 'Igual que el período anterior' : null
  const change = ((current - previous) / Math.abs(previous)) * 100
  if (Math.abs(change) < 0.5) return 'Igual que el período anterior'
  const rounded = Math.round(Math.abs(change))
  return change > 0 ? `${rounded} % más que el período anterior` : `${rounded} % menos que el período anterior`
}

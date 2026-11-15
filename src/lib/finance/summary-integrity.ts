export type FinanceDates = { startDate: string; endDate: string }
type SummaryShape = {
  accrued: { revenue: number; directCosts: number; grossProfit: number | null; operatingExpenses: number; payrollCost: number; netProfit: number | null }
  cash: { collected: number; paid: number; netCashFlow: number }
  complete?: boolean; coverageWarnings?: unknown[]; overdue?: unknown[]; upcomingDue?: unknown[]
  receivables?: { total: number; overdue: number; credits: number; repairs: number; customers: number }
  receivablesStatus?: 'available' | 'unavailable'
}
export function validateFinanceDates(dates: FinanceDates): FinanceDates {
  for (const value of [dates.startDate, dates.endDate]) {
    const parsed = new Date(`${value}T12:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('Ingresá fechas válidas con formato AAAA-MM-DD.')
  }
  if (dates.startDate > dates.endDate) throw new Error('La fecha inicial no puede ser posterior a la final.')
  return dates
}
export function isFinanceSummaryEmpty(data: SummaryShape): boolean {
  return data.complete !== false && !data.coverageWarnings?.length && data.receivablesStatus !== 'unavailable'
    && !(data.receivables && data.receivables.total > 0)
    && [data.accrued.revenue, data.accrued.directCosts, data.accrued.grossProfit, data.accrued.operatingExpenses, data.accrued.payrollCost, data.accrued.netProfit].every(value => value === 0 || value === null)
    && [data.cash.collected, data.cash.paid, data.cash.netCashFlow].every(value => value === 0) && !data.overdue?.length && !data.upcomingDue?.length
}
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('El informe financiero recibido está incompleto. Reintentá.')
  return value as Record<string, unknown>
}
function finite(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('El informe contiene importes inválidos. No se mostraron como cero.')
  return value
}
function equal(actual: number, expected: number) {
  if (Math.abs(actual - expected) > 0.021) throw new Error('Los totales del informe no coinciden con su detalle. Volvé a consultar.')
}
function accruedIntegrity(value: unknown) {
  const row = object(value)
  const revenue = finite(row.revenue), cost = finite(row.directCosts), expenses = finite(row.operatingExpenses), payroll = finite(row.payrollCost)
  if (row.grossProfit !== null) equal(finite(row.grossProfit), revenue - cost)
  if (row.netProfit !== null) equal(finite(row.netProfit), revenue - cost - expenses - payroll)
}
/** Shared runtime boundary: a failed or malformed report is never rendered as a successful zero. */
export function assertFinanceSummaryIntegrity(value: unknown): asserts value is SummaryShape {
  const report = object(value)
  accruedIntegrity(report.accrued)
  const cash = object(report.cash)
  equal(finite(cash.netCashFlow), finite(cash.collected) - finite(cash.paid))
  if (!Array.isArray(report.overdue) || !Array.isArray(report.upcomingDue)) throw new Error('Falta el detalle de vencimientos del informe.')
  for (const row of [...report.overdue, ...report.upcomingDue]) {
    const item = object(row)
    if (finite(item.amount) < 0 || typeof item.dueDate !== 'string') throw new Error('Hay vencimientos inválidos en el informe.')
    validateFinanceDates({ startDate: item.dueDate, endDate: item.dueDate })
  }
  if (report.receivables) {
    const debt = object(report.receivables)
    for (const key of ['total', 'overdue', 'credits', 'repairs', 'customers']) if (finite(debt[key]) < 0) throw new Error('El saldo por cobrar no es válido.')
    equal(finite(debt.total), finite(debt.credits) + finite(debt.repairs))
    if (finite(debt.overdue) > finite(debt.total) + 0.021 || !Number.isInteger(debt.customers)) throw new Error('El saldo vencido no coincide con la deuda.')
  }
  if (report.comparison) accruedIntegrity(object(report.comparison).accrued)
}
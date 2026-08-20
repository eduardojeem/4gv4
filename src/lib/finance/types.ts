export type FinancePaymentMethod = 'cash' | 'bank_transfer' | 'other'

export const MAX_FINANCE_AMOUNT = 999_999_999_999.99

function decimalScale(value: number): number {
  const [coefficient, exponentPart] = value.toString().toLowerCase().split('e')
  const decimalPoint = coefficient.indexOf('.')
  const coefficientScale =
    decimalPoint === -1 ? 0 : coefficient.length - decimalPoint - 1
  const exponent = exponentPart === undefined ? 0 : Number(exponentPart)

  return coefficientScale - exponent
}

export function isFinanceAmount(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= 0 &&
    value <= MAX_FINANCE_AMOUNT &&
    decimalScale(value) <= 2
  )
}

export interface FinanceFilters {
  startDate: string
  endDate: string
  branchId?: string | null
}

/** Tipo de registro que origina un importe, para poder nombrarlo en el panel. */
export type FinanceSourceType = 'sale' | 'repair' | 'order'

export interface FinancialSourceLine {
  id?: string
  amount: number
  /**
   * Identificador legible del registro: codigo de venta, ticket de reparacion,
   * numero de pedido. El id es un uuid y no le dice nada a quien lee el aviso.
   */
  label?: string
  sourceType?: FinanceSourceType
}

export interface FinancialRevenueLine extends FinancialSourceLine {
  cashAmount: number
  hasCost: boolean
}

export interface FinancialPayableLine extends FinancialSourceLine {
  paidAmount: number
}

/**
 * Devolucion cerrada de posventa.
 *
 * Una devolucion revierte una venta que ya se conto como ingreso. Sin esto el
 * resumen mostraba la utilidad inflada: la venta seguia sumando completa y el
 * reintegro no aparecia por ningun lado, porque sale por `cash_movements` o
 * como saldo a favor, tablas que el resumen no lee.
 */
export interface FinancialRefundLine extends FinancialSourceLine {
  /**
   * Costo directo que vuelve a ser inventario. Solo se recupera si la
   * mercaderia volvio vendible: en cuarentena o si el cliente se queda con el
   * producto, el costo queda hundido y la perdida es el total reintegrado.
   */
  recoveredCost: number
  /**
   * Parte del reintegro que salio de la caja. Un saldo a favor no mueve
   * efectivo, asi que afecta la utilidad pero no el flujo del periodo.
   */
  cashAmount: number
}

export interface FinancialSummaryInput {
  revenue: FinancialRevenueLine[]
  directCosts: FinancialPayableLine[]
  expenses: FinancialPayableLine[]
  payroll: FinancialPayableLine[]
  /** Opcional: un periodo sin devoluciones cerradas no necesita declararlo. */
  refunds?: FinancialRefundLine[]
}

export type CoverageWarningCode =
  | 'MISSING_DIRECT_COST'
  | 'MISSING_CASH_TIMING'
  | 'MISSING_BRANCH'
  | 'MISSING_EMPLOYEE'

export interface CoverageWarning {
  code: CoverageWarningCode
  message: string
  sourceId?: string
  /** Como nombrar el registro en pantalla, para poder ir a completarlo. */
  sourceLabel?: string
  sourceType?: FinanceSourceType
}

export interface FinanceSummary {
  accrued: {
    revenue: number
    directCosts: number
    grossProfit: number | null
    operatingExpenses: number
    payrollCost: number
    netProfit: number | null
  }
  cash: {
    collected: number
    paid: number
    netCashFlow: number
  }
  complete: boolean
  coverageWarnings: CoverageWarning[]
}

export type CommissionScopeType = 'role' | 'employee'
export type CommissionCalculationType = 'percentage' | 'fixed'
export type CommissionSource =
  | 'sale'
  | 'product'
  | 'category'
  | 'repair'
  | 'repair_labor'
  | 'goal'

export interface CommissionRule {
  id: string
  scopeType: CommissionScopeType
  employeeId?: string
  role?: string
  branchId?: string | null
  source: CommissionSource
  calculationType: CommissionCalculationType
  value: number
  effectiveFrom: string
  effectiveTo?: string | null
}

export interface CommissionContext {
  employeeId: string
  role?: string | null
  branchId?: string | null
  source: CommissionSource
  occurredOn: string
}

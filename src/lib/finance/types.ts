export type FinancePaymentMethod = 'cash' | 'bank_transfer' | 'other'

export const MAX_FINANCE_AMOUNT = 999_999_999_999.99

export interface FinanceFilters {
  startDate: string
  endDate: string
  branchId?: string | null
}

export interface FinancialSourceLine {
  id?: string
  amount: number
}

export interface FinancialRevenueLine extends FinancialSourceLine {
  cashAmount: number
  hasCost: boolean
}

export interface FinancialPayableLine extends FinancialSourceLine {
  paidAmount: number
}

export interface FinancialSummaryInput {
  revenue: FinancialRevenueLine[]
  directCosts: FinancialPayableLine[]
  expenses: FinancialPayableLine[]
  payroll: FinancialPayableLine[]
}

export type CoverageWarningCode =
  | 'MISSING_DIRECT_COST'
  | 'MISSING_BRANCH'
  | 'MISSING_EMPLOYEE'

export interface CoverageWarning {
  code: CoverageWarningCode
  message: string
  sourceId?: string
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

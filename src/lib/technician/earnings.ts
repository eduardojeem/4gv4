// Cálculo de compensación de técnicos (puro, sin dependencias de DB/UI).

export type CommissionBase = 'labor' | 'final'
export type AccrualStatus = 'listo' | 'entregado'

export interface CompensationConfig {
  base_salary: number
  commission_rate: number // 0-100
  commission_base: CommissionBase
  fixed_per_repair: number
  accrual_status: AccrualStatus
  /** Fecha desde la que corre el sueldo base (YYYY-MM-DD). null = sin fecha (mes completo). */
  salary_effective_from: string | null
}

export const DEFAULT_COMPENSATION: CompensationConfig = {
  base_salary: 0,
  commission_rate: 0,
  commission_base: 'labor',
  fixed_per_repair: 0,
  accrual_status: 'entregado',
  salary_effective_from: null,
}

export interface EarningRepair {
  labor_cost?: number | null
  final_cost?: number | null
  estimated_cost?: number | null
}

export interface EarningsResult {
  base: number
  commission: number
  fixed: number
  total: number
  repairsCount: number
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** Monto base de la comisión de una reparación según la configuración. */
export function commissionableAmount(config: CompensationConfig, repair: EarningRepair): number {
  if (config.commission_base === 'labor') {
    return Number(repair.labor_cost ?? 0)
  }
  return Number(repair.final_cost ?? repair.estimated_cost ?? 0)
}

/**
 * Calcula la ganancia del técnico para un conjunto de reparaciones ya filtradas
 * (las que devengan en el período). `baseProration` prorratea el sueldo base
 * (1 = mes completo).
 */
export function computeEarnings(
  config: CompensationConfig,
  repairs: EarningRepair[],
  baseProration = 1,
): EarningsResult {
  const repairsCount = repairs.length

  const commission = repairs.reduce((sum, repair) => {
    return sum + commissionableAmount(config, repair) * (config.commission_rate / 100)
  }, 0)

  const fixed = repairsCount * config.fixed_per_repair
  const base = config.base_salary * Math.max(0, baseProration)
  const total = base + commission + fixed

  return {
    base: round2(base),
    commission: round2(commission),
    fixed: round2(fixed),
    total: round2(total),
    repairsCount,
  }
}

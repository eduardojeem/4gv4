import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_COMPENSATION,
  computeEarnings,
  type CompensationConfig,
  type EarningRepair,
  type EarningsResult,
} from '@/lib/technician/earnings'

type RepairRow = {
  status?: string | null
  labor_cost?: number | null
  final_cost?: number | null
  estimated_cost?: number | null
  completed_at?: string | null
  delivered_at?: string | null
}

/** Una reparación devenga si cerró (completed/delivered) en el rango y su
 *  estado corresponde al modo de devengo configurado. */
export function qualifiesForAccrual(
  row: RepairRow,
  accrual: CompensationConfig['accrual_status'],
  from: string,
  to: string,
): boolean {
  const status = String(row.status || '').toLowerCase()
  const statusOk = accrual === 'entregado'
    ? status === 'entregado'
    : status === 'listo' || status === 'entregado'
  if (!statusOk) return false
  const closedAt = row.completed_at || row.delivered_at || null
  return Boolean(closedAt && closedAt >= from && closedAt < to)
}

export async function getTechnicianCompensation(
  supabase: SupabaseClient,
  organizationId: string,
  technicianId: string,
): Promise<CompensationConfig> {
  const { data } = await supabase
    .from('technician_compensation')
    .select('base_salary, commission_rate, commission_base, fixed_per_repair, accrual_status, salary_effective_from')
    .eq('organization_id', organizationId)
    .eq('technician_id', technicianId)
    .maybeSingle()

  if (!data) return { ...DEFAULT_COMPENSATION }
  return {
    base_salary: Number(data.base_salary) || 0,
    commission_rate: Number(data.commission_rate) || 0,
    commission_base: (data.commission_base as CompensationConfig['commission_base']) || 'labor',
    fixed_per_repair: Number(data.fixed_per_repair) || 0,
    accrual_status: (data.accrual_status as CompensationConfig['accrual_status']) || 'entregado',
    salary_effective_from: (data.salary_effective_from as string | null) ?? null,
  }
}

/**
 * Prorratea el sueldo base del mes según la fecha "vigente desde".
 * - Sin fecha o vigente antes del mes → 1 (mes completo).
 * - Vigente a mitad de mes → días trabajados / días del mes.
 * - Vigente después del mes consultado → 0 (todavía no corre).
 */
export function computeBaseProration(effectiveFrom: string | null | undefined, periodFrom: string): number {
  if (!effectiveFrom) return 1
  const fromD = new Date(periodFrom)
  const monthStart = new Date(fromD.getFullYear(), fromD.getMonth(), 1)
  const monthEnd = new Date(fromD.getFullYear(), fromD.getMonth() + 1, 0)
  const daysInMonth = monthEnd.getDate()
  const eff = new Date(effectiveFrom)
  if (eff <= monthStart) return 1
  if (eff > monthEnd) return 0
  const daysWorked = daysInMonth - eff.getDate() + 1
  return Math.min(Math.max(daysWorked / daysInMonth, 0), 1)
}

/** Calcula el devengado del técnico en un período (config + reparaciones que
 *  devengan). `baseProration` prorratea el sueldo base. */
export async function computeTechnicianEarnings(
  supabase: SupabaseClient,
  organizationId: string,
  technicianId: string,
  branchId: string | null | undefined,
  from: string,
  to: string,
): Promise<{ compensation: CompensationConfig; earnings: EarningsResult }> {
  const compensation = await getTechnicianCompensation(supabase, organizationId, technicianId)
  const baseProration = computeBaseProration(compensation.salary_effective_from, from)

  let query = supabase
    .from('repairs')
    .select('status, labor_cost, final_cost, estimated_cost, completed_at, delivered_at')
    .eq('organization_id', organizationId)
    .eq('technician_id', technicianId)

  if (branchId) query = query.eq('branch_id', branchId)

  const { data: repairs, error } = await query
  if (error) throw error

  const qualifying = ((repairs as RepairRow[] | null) ?? []).filter((row) =>
    qualifiesForAccrual(row, compensation.accrual_status, from, to),
  )

  const earningRepairs: EarningRepair[] = qualifying.map((row) => ({
    labor_cost: row.labor_cost,
    final_cost: row.final_cost,
    estimated_cost: row.estimated_cost,
  }))

  return { compensation, earnings: computeEarnings(compensation, earningRepairs, baseProration) }
}

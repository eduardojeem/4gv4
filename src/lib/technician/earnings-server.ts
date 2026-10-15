import type { SupabaseClient } from '@supabase/supabase-js'
import { computeVersionedEarnings, type CompensationVersion } from './versioned-earnings'
import {
  DEFAULT_COMPENSATION,
  type CompensationConfig,
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
  const closedAt = accrual === 'entregado'
    ? row.delivered_at
    : row.completed_at || row.delivered_at
  if (!closedAt) return false
  const timestamp = Date.parse(closedAt)
  return Number.isFinite(timestamp) && timestamp >= Date.parse(from) && timestamp < Date.parse(to)
}

export async function getTechnicianCompensation(
  supabase: SupabaseClient,
  organizationId: string,
  technicianId: string,
): Promise<CompensationConfig> {
  const { data, error } = await supabase
    .from('technician_compensation')
    .select('base_salary, commission_rate, commission_base, fixed_per_repair, accrual_status, salary_effective_from')
    .eq('organization_id', organizationId)
    .eq('technician_id', technicianId)
    .maybeSingle()

  if (error) throw error
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
  if (!Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to)) || Date.parse(from) >= Date.parse(to)) {
    throw new Error('Período inválido')
  }
  const compensation = await getTechnicianCompensation(supabase, organizationId, technicianId)
  const versions: CompensationVersion[] = []
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await supabase.from('technician_compensation_versions')
      .select('effective_from, config').eq('organization_id', organizationId).eq('technician_id', technicianId)
      .order('effective_from', { ascending: true }).range(offset, offset + 199)
    if (error) throw error
    const page = (data as CompensationVersion[] | null) ?? []
    versions.push(...page)
    if (page.length < 200) break
  }
  const { data: settings, error: settingsError } = await supabase.from('organization_settings')
    .select('timezone').eq('organization_id', organizationId).maybeSingle()
  if (settingsError) throw settingsError
  const timeZone = settings?.timezone || 'America/Asuncion'

  let query = supabase
    .from('repairs')
    .select('status, labor_cost, final_cost, estimated_cost, completed_at, delivered_at')
    .eq('organization_id', organizationId)
    .eq('technician_id', technicianId)
    .eq('is_deleted', false)
    .order('id', { ascending: true })

  if (branchId) query = query.eq('branch_id', branchId)

  const repairs: RepairRow[] = []
  const pageSize = 200
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await query.range(offset, offset + pageSize - 1)
    if (error) throw error
    const page = (data as RepairRow[] | null) ?? []
    repairs.push(...page)
    if (page.length < pageSize) break
  }

  return computeVersionedEarnings(versions.length ? versions : [{ effective_from: '1900-01-01', config: compensation }], repairs, from, to, timeZone)
}

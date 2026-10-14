import { addDays, utcToZoned, zonedToUtc } from '@/lib/agenda/time'
import { DEFAULT_COMPENSATION, computeEarnings, type CompensationConfig, type EarningRepair, type EarningsResult } from './earnings'

export type CompensationVersion = { effective_from: string; config: CompensationConfig }
export type DatedEarningRepair = EarningRepair & { status?: string | null; completed_at?: string | null; delivered_at?: string | null }

/** Closed payroll entries remain snapshots; this computes the operational estimate. */
export function computeVersionedEarnings(
  sourceVersions: CompensationVersion[], repairs: DatedEarningRepair[], from: string, to: string, timeZone: string,
): { compensation: CompensationConfig; earnings: EarningsResult } {
  const start = Date.parse(from), end = Date.parse(to)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end || end - start > 366 * 86400000) throw new Error('Período inválido')
  const versions = [...sourceVersions].sort((a, b) => a.effective_from.localeCompare(b.effective_from))
  const configAt = (day: string) => [...versions].reverse().find(version => version.effective_from <= day)?.config ?? DEFAULT_COMPENSATION
  let base = 0, commission = 0, fixed = 0, repairsCount = 0
  const lastDay = utcToZoned(end - 1, timeZone).date
  for (let day = utcToZoned(start, timeZone).date; day <= lastDay; day = addDays(day, 1)) {
    const config = configAt(day)
    if (config.salary_effective_from && day < config.salary_effective_from) continue
    const [year, month] = day.split('-').map(Number)
    base += config.base_salary / new Date(Date.UTC(year, month, 0)).getUTCDate()
  }
  for (const repair of repairs) {
    if (!['listo', 'entregado'].includes(String(repair.status))) continue
    const candidates = versions.flatMap((version, index) => {
      const config = version.config
      if (config.accrual_status === 'entregado' && repair.status !== 'entregado') return []
      const raw = config.accrual_status === 'entregado' ? repair.delivered_at : repair.completed_at || repair.delivered_at
      const instant = raw ? Date.parse(raw) : NaN
      if (!Number.isFinite(instant)) return []
      const versionStart = zonedToUtc(version.effective_from, '00:00', timeZone)
      const versionEnd = versions[index + 1] ? zonedToUtc(versions[index + 1].effective_from, '00:00', timeZone) : Infinity
      return instant >= versionStart && instant < versionEnd ? [{ instant, config }] : []
    }).sort((a, b) => a.instant - b.instant)
    // Select the first qualifying event before filtering the report period.
    const event = candidates[0]
    if (!event || event.instant < start || event.instant >= end) continue
    const amount = computeEarnings(event.config, [repair], 0)
    commission += amount.commission; fixed += amount.fixed; ++repairsCount
  }
  const rounded = (value: number) => Math.round(value * 100) / 100
  return { compensation: configAt(lastDay), earnings: {
    base: rounded(base), commission: rounded(commission), fixed: rounded(fixed), total: rounded(base + commission + fixed), repairsCount,
  } }
}

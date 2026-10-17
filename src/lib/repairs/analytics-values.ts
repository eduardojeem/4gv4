type RepairFigures = {
  dbStatus?: string | null
  finalCost?: number | null
  estimatedCost?: number | null
  completedAt?: string | null
  estimatedCompletion?: string | null
}

/** Revenue is the agreed delivered value, grouped by intake date throughout analytics. */
export function deliveredRepairRevenue(repair: RepairFigures): number {
  return repair.dbStatus === 'entregado' ? (repair.finalCost ?? repair.estimatedCost ?? 0) : 0
}

/** Missing promises are unavailable, rather than assumed late or within seven days. */
export function deliveryPromiseOutcome(repair: RepairFigures): boolean | null {
  if (repair.dbStatus !== 'entregado' || !repair.completedAt || !repair.estimatedCompletion) return null
  const completed = new Date(repair.completedAt).getTime()
  const promised = new Date(repair.estimatedCompletion).getTime()
  if (!Number.isFinite(completed) || !Number.isFinite(promised)) return null
  return completed <= promised
}

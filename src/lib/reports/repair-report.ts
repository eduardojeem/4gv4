type RepairTimingRow = {
  status: string | null
  receivedAt: string | null
  completedAt: string | null
}

export function calculateRepairCompletion(repairs: RepairTimingRow[]) {
  let deliveredCount = 0
  let turnaroundDays = 0
  let timedDeliveredCount = 0

  for (const repair of repairs) {
    if (repair.status !== 'entregado') continue
    deliveredCount += 1

    if (!repair.receivedAt || !repair.completedAt) continue
    const start = new Date(repair.receivedAt).getTime()
    const end = new Date(repair.completedAt).getTime()
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue
    turnaroundDays += Math.max(0, (end - start) / 86_400_000)
    timedDeliveredCount += 1
  }

  return {
    deliveredCount,
    completionRate: repairs.length > 0 ? (deliveredCount / repairs.length) * 100 : 0,
    averageTurnaroundDays: timedDeliveredCount > 0 ? turnaroundDays / timedDeliveredCount : 0,
    timedDeliveredCount,
  }
}

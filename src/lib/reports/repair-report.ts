import { ACTIVE_REPAIR_STATUSES } from '@/lib/constants/repair-status'
import type { RepairStatus } from '@/types/repairs'

type RepairTimingRow = {
  status: string | null
  receivedAt: string | null
  completedAt: string | null
}

/**
 * Resumen de reparaciones para los informes.
 *
 * Devuelve tambien los conteos, no solo la tasa: el PDF pedia
 * `metrics.completed` y `metrics.inProgress`, campos que nadie calculaba, y
 * `formatNumber(undefined)` los pintaba como «0». Quedaba un informe con 120
 * ordenes, 0 finalizadas y 89,2% de finalizacion, tres numeros que no podian ser
 * ciertos a la vez.
 *
 * `deliveredCount` es el numerador de `completionRate` a proposito: si el conteo
 * y la tasa salieran de reglas distintas, volverian a contradecirse.
 */
export function calculateRepairCompletion(repairs: RepairTimingRow[]) {
  let deliveredCount = 0
  let inProgressCount = 0
  let turnaroundDays = 0
  let timedDeliveredCount = 0

  for (const repair of repairs) {
    // El estado viene de la base sin normalizar: comparar crudo dejaba afuera
    // cualquier fila guardada como «Entregado».
    const status = String(repair.status || '').trim().toLowerCase()

    if (ACTIVE_REPAIR_STATUSES.has(status as RepairStatus)) inProgressCount += 1
    if (status !== 'entregado') continue
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
    inProgressCount,
    completionRate: repairs.length > 0 ? (deliveredCount / repairs.length) * 100 : 0,
    averageTurnaroundDays: timedDeliveredCount > 0 ? turnaroundDays / timedDeliveredCount : 0,
    timedDeliveredCount,
  }
}

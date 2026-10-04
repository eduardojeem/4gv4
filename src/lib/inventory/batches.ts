/**
 * Lotes y vencimientos.
 *
 * El stock es uno solo por producto: las ventas no dicen de qué lote salió
 * cada unidad. Para saber qué queda de cada lote se supone lo que hace
 * cualquier almacén ordenado: se vende primero lo que vence antes. Entonces lo
 * que hay hoy en el estante son los lotes que vencen más tarde, y los más
 * viejos ya se vendieron. Es una estimación, pero es la que usa la persona que
 * repone la góndola.
 */

export type BatchStatus = 'expired' | 'week' | 'month' | 'ok'

export interface ProductBatch {
  id: string
  product_id: string
  variant_id: string | null
  lot_code: string | null
  expires_on: string
  quantity: number
  received_on: string
  notes: string | null
  discarded_at: string | null
  discarded_reason: string | null
}

export type EstimatedBatch<T extends ProductBatch = ProductBatch> = T & {
  /** Unidades de este lote que se estima que siguen en stock. */
  remaining: number
  status: BatchStatus
  daysLeft: number
}

export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  expired: 'Vencido',
  week: 'Vence en 7 días',
  month: 'Vence este mes',
  ok: 'En fecha',
}

function dayNumber(date: string) {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number)
  return Date.UTC(year, month - 1, day) / 86_400_000
}

/** Días hasta el vencimiento (negativo si ya venció). */
export function daysUntil(expiresOn: string, today: string) {
  return Math.round(dayNumber(expiresOn) - dayNumber(today))
}

export function batchStatus(expiresOn: string, today: string): BatchStatus {
  const days = daysUntil(expiresOn, today)
  if (days < 0) return 'expired'
  if (days <= 7) return 'week'
  if (days <= 30) return 'month'
  return 'ok'
}

/**
 * Reparte el stock actual entre los lotes vigentes, empezando por los que
 * vencen más tarde. Los descartados no cuentan.
 */
export function estimateBatches<T extends ProductBatch>(batches: T[], currentStock: number, today: string): Array<EstimatedBatch<T>> {
  let left = Math.max(0, Math.trunc(Number(currentStock) || 0))
  const active = batches
    .filter((batch) => !batch.discarded_at)
    .sort((a, b) => b.expires_on.localeCompare(a.expires_on) || b.received_on.localeCompare(a.received_on))
  const remaining = new Map<string, number>()
  for (const batch of active) {
    const take = Math.min(batch.quantity, left)
    remaining.set(batch.id, take)
    left -= take
  }
  return batches
    .map((batch) => ({
      ...batch,
      remaining: batch.discarded_at ? 0 : remaining.get(batch.id) ?? 0,
      status: batchStatus(batch.expires_on, today),
      daysLeft: daysUntil(batch.expires_on, today),
    }))
    .sort((a, b) => a.expires_on.localeCompare(b.expires_on))
}

/** Lo que hay que mirar: lotes con unidades en stock que vencen dentro de `days` (o ya vencieron). */
export function needsAttention(batch: EstimatedBatch, days: number) {
  return !batch.discarded_at && batch.remaining > 0 && batch.daysLeft <= days
}

/** Hoy en formato YYYY-MM-DD en la zona del navegador o del servidor. */
export function todayLocal(now = new Date()) {
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

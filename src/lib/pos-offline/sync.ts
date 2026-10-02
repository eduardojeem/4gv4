import { branchHeaders } from '@/lib/branches/client'
import { listOutbox, removeFromOutbox, updateOutbox, type OutboxSale } from '@/lib/pos-offline/outbox'

/**
 * Manda las ventas guardadas sin conexión, de la más vieja a la más nueva.
 *
 * - Respuesta OK: la venta se registró (o ya estaba, por la clave): sale de la cola.
 * - Sin red o error del servidor (5xx): se corta y se reintenta más tarde.
 * - Sesión vencida (401/403): se corta; hay que volver a entrar.
 * - Rechazo (4xx, p. ej. caja cerrada o sin stock): queda marcada con el
 *   motivo para que alguien la revise. Las siguientes se siguen mandando.
 */

export type SyncOutcome = {
  sent: number
  failed: number
  stopped: 'offline' | 'auth' | 'server' | null
}

/** Lo que no se puede vender sin internet: necesita validar datos del servidor. */
export function offlineBlockReason(sale: {
  payments?: Array<{ payment_method?: string; method?: string }>
  repair_ids?: string[]
  store_credit_amount?: number
  credit?: unknown
}): string | null {
  const methods = (sale.payments ?? []).map((payment) => payment.payment_method ?? payment.method)
  if (sale.credit || methods.includes('credit')) return 'Las ventas a crédito necesitan conexión para armar las cuotas.'
  if ((sale.store_credit_amount ?? 0) > 0) return 'Usar saldo a favor necesita conexión para verificarlo.'
  if (sale.repair_ids?.length) return 'Cobrar reparaciones necesita conexión.'
  return null
}

/** `fetch` tira TypeError cuando no hay red (no cuando el servidor responde un error). */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  return error instanceof TypeError
}

let running: Promise<SyncOutcome> | null = null

async function sendOne(sale: OutboxSale, fetchImpl: typeof fetch): Promise<'sent' | 'rejected' | SyncOutcome['stopped']> {
  let response: Response
  try {
    response = await fetchImpl('/api/pos/process-sale', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-idempotency-key': sale.id,
        ...branchHeaders(sale.branchId),
      },
      body: JSON.stringify(sale.payload),
    })
  } catch {
    return 'offline'
  }

  const body = await response.json().catch(() => null) as { success?: boolean; error?: string } | null
  const now = new Date().toISOString()
  if (response.ok && body?.success !== false) {
    await removeFromOutbox(sale.id)
    return 'sent'
  }
  if (response.status === 401 || response.status === 403) {
    await updateOutbox(sale.id, { attempts: sale.attempts + 1, lastAttemptAt: now, lastError: 'La sesión venció: volvé a iniciar sesión para enviarla.' })
    return 'auth'
  }
  if (response.status >= 500) {
    await updateOutbox(sale.id, { attempts: sale.attempts + 1, lastAttemptAt: now, lastError: body?.error || 'El servidor no respondió bien. Se reintenta solo.' })
    return 'server'
  }
  await updateOutbox(sale.id, { status: 'error', attempts: sale.attempts + 1, lastAttemptAt: now, lastError: body?.error || 'El servidor rechazó la venta.' })
  return 'rejected'
}

export function syncOutbox(fetchImpl: typeof fetch = fetch): Promise<SyncOutcome> {
  // Una sola sincronización a la vez: dos a la vez mandarían la misma venta en paralelo.
  running ??= (async () => {
    const outcome: SyncOutcome = { sent: 0, failed: 0, stopped: null }
    try {
      for (const sale of await listOutbox()) {
        if (sale.status !== 'pending') continue
        const result = await sendOne(sale, fetchImpl)
        if (result === 'sent') outcome.sent += 1
        else if (result === 'rejected') outcome.failed += 1
        else {
          outcome.stopped = result
          break
        }
      }
      return outcome
    } finally {
      running = null
    }
  })()
  return running
}

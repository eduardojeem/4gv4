import {
  isValidPagoparOrderHash,
  queryPagoparOrder,
  type PagoparOrderStatusResult,
} from '@/lib/payments/pagopar'
import { createAdminSupabase } from '@/lib/supabase/admin'
import {
  comparePagoparOrderWithLocalPayment,
  type LocalPagoparSubscriptionPayment,
} from '@/lib/saas/pagopar-subscription-status'
import { AUTOPAY_PAYMENT_METHOD } from '@/lib/saas/subscription-autopay'

/**
 * Los pedidos vencen a las 72 h (fecha_maxima_pago); se mira un día más para
 * alcanzar a ver la cancelación que Pagopar marca al vencer.
 */
export const PAGOPAR_RECONCILE_WINDOW_MS = 96 * 60 * 60 * 1000
const PAGOPAR_RECONCILE_BATCH = 50

export type PagoparSyncOutcome = 'applied' | 'already_paid' | 'failed' | 'unchanged'

export type PagoparReconcileResult = {
  checked: number
  applied: number
  failed: number
  unchanged: number
  errors: number
}

function parsePaidAt(value: string | null) {
  const parsed = value ? new Date(value) : null
  return parsed && Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString()
}

/**
 * Lleva al pago local lo que Pagopar confirmó por consulta del servidor. Es la
 * misma aplicación que hace el webhook y la función de la base es idempotente,
 * así que no importa cuál de los dos llegue primero.
 */
export async function syncPagoparPaymentStatus(
  localPayment: LocalPagoparSubscriptionPayment,
  providerOrder: PagoparOrderStatusResult,
): Promise<PagoparSyncOutcome> {
  if (localPayment.status === 'paid') return 'already_paid'
  const admin = createAdminSupabase()

  if (providerOrder.status === 'approved') {
    const { error } = await admin.rpc('apply_paid_subscription_payment', {
      p_external_reference: localPayment.external_reference,
      p_provider_payment_id: providerOrder.providerOrderId || '',
      p_payment_method: providerOrder.paymentMethod || 'Pagopar',
      p_paid_at: parsePaidAt(providerOrder.paidAt),
      p_amount: providerOrder.amount,
    })
    if (error) throw new Error(`No se pudo aplicar el pago: ${error.message}`)
    return 'applied'
  }

  if (providerOrder.status === 'cancelled' && localPayment.status === 'pending') {
    const { error } = await admin
      .from('subscription_payments')
      .update({ status: 'failed' })
      .eq('id', localPayment.id)
      .eq('status', 'pending')
    if (error) throw new Error(`No se pudo marcar el pago como fallido: ${error.message}`)
    return 'failed'
  }

  return 'unchanged'
}

/**
 * Red de seguridad para notificaciones perdidas: vuelve a consultar en Pagopar
 * los pagos únicos que siguen pendientes. El débito automático tiene su propio
 * ciclo de reintentos y no pasa por acá.
 */
export async function reconcilePendingPagoparPayments(now = new Date()): Promise<PagoparReconcileResult> {
  const since = new Date(now.getTime() - PAGOPAR_RECONCILE_WINDOW_MS).toISOString()
  const { data, error } = await createAdminSupabase()
    .from('subscription_payments')
    .select('id, amount, currency, status, plan_id, provider_payment_id, external_reference')
    .eq('provider', 'pagopar')
    .eq('status', 'pending')
    .neq('payment_method', AUTOPAY_PAYMENT_METHOD)
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(PAGOPAR_RECONCILE_BATCH)

  if (error) throw new Error(`No se pudieron leer los pagos pendientes: ${error.message}`)

  const result: PagoparReconcileResult = { checked: 0, applied: 0, failed: 0, unchanged: 0, errors: 0 }

  for (const row of data ?? []) {
    const hash = String(row.external_reference ?? '')
    if (!isValidPagoparOrderHash(hash)) continue
    result.checked += 1

    const localPayment = { ...row, amount: Number(row.amount), external_reference: hash } as LocalPagoparSubscriptionPayment
    try {
      const providerOrder = await queryPagoparOrder(hash)
      const comparison = comparePagoparOrderWithLocalPayment(localPayment, providerOrder)
      if (comparison.ok === false) {
        console.warn('[pagopar-reconcile] La respuesta no coincide con el pago local.', {
          paymentId: localPayment.id,
          reason: comparison.reason,
        })
        result.errors += 1
        continue
      }

      const outcome = await syncPagoparPaymentStatus(localPayment, providerOrder)
      if (outcome === 'applied') result.applied += 1
      else if (outcome === 'failed') result.failed += 1
      else result.unchanged += 1
    } catch (error) {
      console.error('[pagopar-reconcile] No se pudo conciliar el pago.', {
        paymentId: localPayment.id,
        reason: error instanceof Error ? error.message : 'unknown_error',
      })
      result.errors += 1
    }
  }

  return result
}

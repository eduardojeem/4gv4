import {
  isValidBancardShopProcessId,
  queryBancardPayment,
  rollbackBancardPayment,
  type BancardOrderStatusResult,
} from '@/lib/payments/bancard'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { AUTOPAY_PAYMENT_METHOD, BANCARD_CARD_PAYMENT_METHOD } from '@/lib/saas/subscription-checkout'
import { sendSubscriptionPaymentReceipt } from '@/lib/saas/subscription-notifications'

export type LocalBancardSubscriptionPayment = {
  id: string
  amount: number
  currency: string
  status: string
  plan_id: string | null
  payment_method: string | null
  provider_payment_id: string | null
  external_reference: string
  created_at: string | null
}

export type BancardPaymentComparison =
  | { ok: true }
  | { ok: false; reason: 'reference_mismatch' | 'amount_mismatch' }

export type SubscriptionBancardVerification =
  | { kind: 'verified'; localPayment: LocalBancardSubscriptionPayment; providerOrder: BancardOrderStatusResult }
  | { kind: 'not_found' }
  | { kind: 'mismatch'; reason: Exclude<BancardPaymentComparison, { ok: true }>['reason'] }
  | { kind: 'unavailable' }

export type BancardSyncOutcome = 'applied' | 'already_paid' | 'failed' | 'unchanged'

export type BancardReconcileResult = {
  checked: number
  applied: number
  failed: number
  unchanged: number
  errors: number
}

const PAYMENT_COLUMNS = 'id, amount, currency, status, plan_id, payment_method, provider_payment_id, external_reference, created_at'

/** Se miran dos días: pasadas 24 h sin confirmación el pago se da por abandonado. */
export const BANCARD_RECONCILE_WINDOW_MS = 48 * 60 * 60 * 1000
const BANCARD_RECONCILE_BATCH = 50

function toLocalPayment(row: Record<string, unknown>): LocalBancardSubscriptionPayment {
  return {
    ...(row as unknown as LocalBancardSubscriptionPayment),
    amount: Number(row.amount),
    external_reference: String(row.external_reference ?? ''),
  }
}

export function compareBancardOrderWithLocalPayment(
  localPayment: LocalBancardSubscriptionPayment,
  providerOrder: BancardOrderStatusResult,
): BancardPaymentComparison {
  if (localPayment.external_reference !== providerOrder.shopProcessId) {
    return { ok: false, reason: 'reference_mismatch' }
  }
  if (providerOrder.amount !== null && Math.abs(Number(localPayment.amount) - providerOrder.amount) > 0.5) {
    return { ok: false, reason: 'amount_mismatch' }
  }
  return { ok: true }
}

/**
 * Lleva al pago local lo que Bancard confirmó. Es la misma aplicación que hace
 * el webhook y la función de la base es idempotente, así que no importa cuál
 * de los dos llegue primero.
 */
export async function syncBancardPaymentStatus(
  localPayment: LocalBancardSubscriptionPayment,
  providerOrder: BancardOrderStatusResult,
  options: { sendReceipt?: boolean } = {},
): Promise<BancardSyncOutcome> {
  if (localPayment.status === 'paid') return 'already_paid'
  const admin = createAdminSupabase()

  if (providerOrder.status === 'approved') {
    const { error } = await admin.rpc('apply_paid_provider_subscription_payment', {
      p_provider: 'bancard',
      p_external_reference: localPayment.external_reference,
      p_provider_payment_id: providerOrder.authorizationNumber || providerOrder.ticketNumber || '',
      p_payment_method: localPayment.payment_method || BANCARD_CARD_PAYMENT_METHOD,
      p_paid_at: new Date().toISOString(),
      p_amount: providerOrder.amount,
    })
    if (error) throw new Error(`No se pudo aplicar el pago: ${error.message}`)
    if (options.sendReceipt !== false) await sendSubscriptionPaymentReceipt(localPayment.id)
    return 'applied'
  }

  if ((providerOrder.status === 'cancelled' || providerOrder.status === 'rejected') && localPayment.status === 'pending') {
    // Pedido abandonado: el manual de Bancard pide anularlo (rollback) para que
    // no quede abierto. Si nunca se pagó, Bancard responde PaymentNotFoundError,
    // que es la respuesta correcta. Un fallo acá no impide cerrar el pago local.
    if (providerOrder.status === 'cancelled' && localPayment.external_reference) {
      await rollbackBancardPayment(localPayment.external_reference).catch((rollbackError: unknown) => {
        console.warn('[bancard] No se pudo anular el pedido abandonado.', {
          paymentId: localPayment.id,
          reason: rollbackError instanceof Error ? rollbackError.message : 'unknown_error',
        })
      })
    }
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

export async function verifySubscriptionBancardPayment(
  organizationId: string,
  shopProcessId: string,
): Promise<SubscriptionBancardVerification> {
  const { data, error } = await createAdminSupabase()
    .from('subscription_payments')
    .select(PAYMENT_COLUMNS)
    .eq('organization_id', organizationId)
    .eq('provider', 'bancard')
    .eq('external_reference', shopProcessId)
    .maybeSingle()

  if (error) {
    console.error('[bancard-return] No se pudo consultar el pago local.', { organizationId, code: error.code })
    return { kind: 'unavailable' }
  }
  if (!data?.external_reference) return { kind: 'not_found' }

  const localPayment = toLocalPayment(data)
  try {
    const providerOrder = await queryBancardPayment(shopProcessId, localPayment.created_at)
    const comparison = compareBancardOrderWithLocalPayment(localPayment, providerOrder)
    if (comparison.ok === false) {
      console.warn('[bancard-return] La respuesta no coincide con el pago local.', {
        organizationId,
        paymentId: localPayment.id,
        reason: comparison.reason,
      })
      return { kind: 'mismatch', reason: comparison.reason }
    }
    return { kind: 'verified', localPayment, providerOrder }
  } catch (verifyError) {
    console.error('[bancard-return] No se pudo verificar el pago con Bancard.', {
      organizationId,
      paymentId: localPayment.id,
      reason: verifyError instanceof Error ? verifyError.message : 'unknown_error',
    })
    return { kind: 'unavailable' }
  }
}

/**
 * Red de seguridad para confirmaciones perdidas: vuelve a consultar en Bancard
 * los pagos únicos que siguen pendientes. El débito automático tiene su propio
 * ciclo de reintentos y no pasa por acá.
 */
export async function reconcilePendingBancardPayments(now = new Date()): Promise<BancardReconcileResult> {
  const since = new Date(now.getTime() - BANCARD_RECONCILE_WINDOW_MS).toISOString()
  const { data, error } = await createAdminSupabase()
    .from('subscription_payments')
    .select(PAYMENT_COLUMNS)
    .eq('provider', 'bancard')
    .eq('status', 'pending')
    .neq('payment_method', AUTOPAY_PAYMENT_METHOD)
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(BANCARD_RECONCILE_BATCH)

  if (error) throw new Error(`No se pudieron leer los pagos pendientes: ${error.message}`)

  const result: BancardReconcileResult = { checked: 0, applied: 0, failed: 0, unchanged: 0, errors: 0 }

  for (const row of data ?? []) {
    const localPayment = toLocalPayment(row)
    if (!isValidBancardShopProcessId(localPayment.external_reference)) continue
    result.checked += 1

    try {
      const providerOrder = await queryBancardPayment(localPayment.external_reference, localPayment.created_at, now)
      const comparison = compareBancardOrderWithLocalPayment(localPayment, providerOrder)
      if (comparison.ok === false) {
        console.warn('[bancard-reconcile] La respuesta no coincide con el pago local.', {
          paymentId: localPayment.id,
          reason: comparison.reason,
        })
        result.errors += 1
        continue
      }

      const outcome = await syncBancardPaymentStatus(localPayment, providerOrder)
      if (outcome === 'applied') result.applied += 1
      else if (outcome === 'failed') result.failed += 1
      else result.unchanged += 1
    } catch (reconcileError) {
      console.error('[bancard-reconcile] No se pudo conciliar el pago.', {
        paymentId: localPayment.id,
        reason: reconcileError instanceof Error ? reconcileError.message : 'unknown_error',
      })
      result.errors += 1
    }
  }

  return result
}

import { queryPagoparOrder, type PagoparOrderStatusResult } from '@/lib/payments/pagopar'
import { createAdminSupabase } from '@/lib/supabase/admin'

export type LocalPagoparSubscriptionPayment = {
  id: string
  amount: number
  currency: string
  status: string
  plan_id: string | null
  provider_payment_id: string | null
  external_reference: string
}

export type PagoparPaymentComparison =
  | { ok: true }
  | { ok: false; reason: 'hash_mismatch' | 'amount_mismatch' | 'reference_mismatch' }

export type SubscriptionPagoparVerification =
  | { kind: 'verified'; localPayment: LocalPagoparSubscriptionPayment; providerOrder: PagoparOrderStatusResult }
  | { kind: 'not_found' }
  | { kind: 'mismatch'; reason: Exclude<PagoparPaymentComparison, { ok: true }>['reason'] }
  | { kind: 'unavailable' }

export function comparePagoparOrderWithLocalPayment(
  localPayment: LocalPagoparSubscriptionPayment,
  providerOrder: PagoparOrderStatusResult,
): PagoparPaymentComparison {
  if (localPayment.external_reference !== providerOrder.hash) {
    return { ok: false, reason: 'hash_mismatch' }
  }
  if (Math.abs(Number(localPayment.amount) - providerOrder.amount) > 0.5) {
    return { ok: false, reason: 'amount_mismatch' }
  }
  if (
    localPayment.provider_payment_id
    && providerOrder.providerOrderId
    && localPayment.provider_payment_id !== providerOrder.providerOrderId
  ) {
    return { ok: false, reason: 'reference_mismatch' }
  }
  return { ok: true }
}

export async function verifySubscriptionPagoparPayment(
  organizationId: string,
  hash: string,
): Promise<SubscriptionPagoparVerification> {
  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('subscription_payments')
    .select('id, amount, currency, status, plan_id, provider_payment_id, external_reference')
    .eq('organization_id', organizationId)
    .eq('provider', 'pagopar')
    .eq('external_reference', hash)
    .maybeSingle()

  if (error) {
    console.error('[pagopar-return] No se pudo consultar el pago local.', { organizationId, code: error.code })
    return { kind: 'unavailable' }
  }
  if (!data?.external_reference) return { kind: 'not_found' }

  try {
    const localPayment = {
      ...data,
      amount: Number(data.amount),
      external_reference: String(data.external_reference),
    } as LocalPagoparSubscriptionPayment
    const providerOrder = await queryPagoparOrder(hash)
    const comparison = comparePagoparOrderWithLocalPayment(localPayment, providerOrder)

    if (comparison.ok === false) {
      console.warn('[pagopar-return] La respuesta no coincide con el pago local.', {
        organizationId,
        paymentId: localPayment.id,
        reason: comparison.reason,
      })
      return { kind: 'mismatch', reason: comparison.reason }
    }

    return { kind: 'verified', localPayment, providerOrder }
  } catch (error) {
    console.error('[pagopar-return] No se pudo verificar el pedido con Pagopar.', {
      organizationId,
      paymentId: data.id,
      reason: error instanceof Error ? error.message : 'unknown_error',
    })
    return { kind: 'unavailable' }
  }
}

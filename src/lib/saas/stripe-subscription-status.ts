import type Stripe from 'stripe'
import { fromStripeUnitAmount, getStripe } from '@/lib/payments/stripe'
import { createAdminSupabase } from '@/lib/supabase/admin'

export type StripeSessionDisplayStatus = 'approved' | 'pending' | 'expired'

export type LocalStripeSubscriptionPayment = {
  id: string
  amount: number
  currency: string
  status: string
  plan_id: string | null
  external_reference: string
}

export type SubscriptionStripeVerification =
  | {
    kind: 'verified'
    localPayment: LocalStripeSubscriptionPayment
    status: StripeSessionDisplayStatus
    amount: number
  }
  | { kind: 'not_found' }
  | { kind: 'mismatch' }
  | { kind: 'unavailable' }

export function getStripeSessionDisplayStatus(
  session: Pick<Stripe.Checkout.Session, 'status' | 'payment_status'>,
): StripeSessionDisplayStatus {
  if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') return 'approved'
  if (session.status === 'expired') return 'expired'
  return 'pending'
}

/**
 * Solo informa el estado al volver de Stripe. La activación del plan la hace
 * únicamente el webhook firmado.
 */
export async function verifySubscriptionStripePayment(
  organizationId: string,
  sessionId: string,
): Promise<SubscriptionStripeVerification> {
  let session: Stripe.Checkout.Session
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId)
  } catch (error) {
    console.error('[stripe-return] No se pudo consultar la sesión.', {
      organizationId,
      reason: error instanceof Error ? error.message : 'unknown_error',
    })
    return { kind: 'unavailable' }
  }

  const reference = session.metadata?.subscription_payment_reference || session.client_reference_id
  if (!reference) return { kind: 'not_found' }

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from('subscription_payments')
    .select('id, amount, currency, status, plan_id, external_reference, provider_payment_id')
    .eq('organization_id', organizationId)
    .eq('provider', 'stripe')
    .eq('external_reference', reference)
    .maybeSingle()

  if (error) {
    console.error('[stripe-return] No se pudo consultar el pago local.', { organizationId, code: error.code })
    return { kind: 'unavailable' }
  }
  if (!data) return { kind: 'not_found' }

  const amount = session.amount_total != null && session.currency
    ? fromStripeUnitAmount(session.amount_total, session.currency)
    : null
  // Antes de pagar provider_payment_id guarda el id de la sesión; después, el del PaymentIntent.
  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id
  const sessionMatches = data.provider_payment_id === session.id
    || (Boolean(paymentIntentId) && data.provider_payment_id === paymentIntentId)
  if (amount === null || Math.abs(Number(data.amount) - amount) > 0.5 || !sessionMatches) {
    console.warn('[stripe-return] La sesión no coincide con el pago local.', { organizationId, paymentId: data.id })
    return { kind: 'mismatch' }
  }

  return {
    kind: 'verified',
    localPayment: {
      id: data.id,
      amount: Number(data.amount),
      currency: data.currency,
      status: data.status,
      plan_id: data.plan_id,
      external_reference: String(data.external_reference),
    },
    status: getStripeSessionDisplayStatus(session),
    amount,
  }
}

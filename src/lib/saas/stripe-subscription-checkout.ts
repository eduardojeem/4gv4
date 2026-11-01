import { randomUUID } from 'crypto'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getStripe, getStripeReturnOrigin, isStripeCheckoutEnabled, toStripeUnitAmount } from '@/lib/payments/stripe'
import {
  resolveSubscriptionCheckoutTarget,
  SubscriptionCheckoutError,
} from '@/lib/saas/pagopar-subscription-checkout'

type CheckoutOrganization = {
  id: string
  name: string
}

export const STRIPE_PAYMENT_METHOD_LABEL = 'Stripe Tarjeta'

/**
 * Crea una sesión de Stripe Checkout (pago único, página alojada) para un mes
 * del plan. La suscripción se activa solo cuando el webhook confirma el cobro.
 */
export async function createSubscriptionStripeCheckout(params: {
  organization: CheckoutOrganization
  userEmail?: string | null
  targetPlanCode?: string | null
  canChangePlan: boolean
  requestOrigin?: string | null
  correlationId?: string
}) {
  const { organization, userEmail, targetPlanCode, canChangePlan, requestOrigin, correlationId } = params

  if (!isStripeCheckoutEnabled()) {
    throw new SubscriptionCheckoutError('El pago con Stripe no está disponible por ahora.', 501)
  }

  const { state, targetPlan, amountPyg } = await resolveSubscriptionCheckoutTarget({
    organizationId: organization.id,
    targetPlanCode,
    canChangePlan,
  })

  const admin = createAdminSupabase()
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const { data: reusablePayment } = await admin
    .from('subscription_payments')
    .select('receipt_url')
    .eq('organization_id', organization.id)
    .eq('plan_id', targetPlan.code)
    .eq('provider', 'stripe')
    .eq('status', 'pending')
    .gte('created_at', fifteenMinutesAgo)
    .not('receipt_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (reusablePayment?.receipt_url) {
    return {
      checkoutUrl: reusablePayment.receipt_url,
      planCode: targetPlan.code,
      paymentMethod: 'stripe' as const,
      correlationId,
      reused: true,
    }
  }

  const externalReference = `STR${Date.now()}${randomUUID().replace(/-/g, '').slice(0, 10)}`
  const { data: payment, error: paymentError } = await admin
    .from('subscription_payments')
    .insert({
      organization_id: organization.id,
      subscription_id: state.subscription?.id || null,
      plan_id: targetPlan.code,
      amount: amountPyg,
      currency: 'PYG',
      status: 'pending',
      payment_method: STRIPE_PAYMENT_METHOD_LABEL,
      provider: 'stripe',
      external_reference: externalReference,
    })
    .select('id')
    .single()

  if (paymentError || !payment) {
    throw new SubscriptionCheckoutError(paymentError?.message || 'No se pudo crear el pago.', 500)
  }

  try {
    const origin = getStripeReturnOrigin(requestOrigin)
    const session = await getStripe().checkout.sessions.create(
      {
        mode: 'payment',
        client_reference_id: externalReference,
        customer_email: state.billingProfile?.billing_email || userEmail || undefined,
        billing_address_collection: 'auto',
        allow_promotion_codes: false,
        submit_type: 'pay',
        locale: 'es',
        // Stripe exige al menos 30 minutos.
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'pyg',
              unit_amount: toStripeUnitAmount(amountPyg, 'PYG'),
              product_data: {
                name: `Plan ${targetPlan.name} - 1 mes`,
                description: `Suscripción MiTiendaPY para ${organization.name}`,
              },
            },
          },
        ],
        metadata: {
          subscription_payment_reference: externalReference,
          organization_id: organization.id,
          plan_code: targetPlan.code,
        },
        payment_intent_data: {
          description: `Suscripción ${targetPlan.name} - ${organization.name}`,
          metadata: {
            subscription_payment_reference: externalReference,
            organization_id: organization.id,
          },
        },
        success_url: `${origin}/admin/subscriptions/payments?stripe_session={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/admin/subscriptions?stripe=cancelled`,
      },
      { idempotencyKey: `subscription-payment-${payment.id}` },
    )

    if (!session.url) {
      throw new Error('Stripe no devolvió la URL de pago.')
    }

    const { error: updateError } = await admin
      .from('subscription_payments')
      .update({
        provider_payment_id: session.id,
        receipt_url: session.url,
      })
      .eq('id', payment.id)

    if (updateError) {
      throw new Error(`No se pudo vincular el pago con Stripe: ${updateError.message}`)
    }

    return {
      checkoutUrl: session.url,
      planCode: targetPlan.code,
      paymentMethod: 'stripe' as const,
      reused: false,
    }
  } catch (error) {
    await admin
      .from('subscription_payments')
      .update({ status: 'failed' })
      .eq('id', payment.id)

    // 424 y no 502: Cloudflare reemplaza las respuestas 502 por su propia página.
    throw new SubscriptionCheckoutError(
      error instanceof Error ? error.message : 'No se pudo iniciar el pago con Stripe.',
      424,
      undefined,
      correlationId,
    )
  }
}

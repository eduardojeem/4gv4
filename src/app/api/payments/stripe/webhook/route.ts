import { NextResponse, after } from 'next/server'
import type Stripe from 'stripe'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { recordWebhookEvent } from '@/lib/health/webhook-log'
import { fromStripeUnitAmount, getStripe } from '@/lib/payments/stripe'
import { STRIPE_PAYMENT_METHOD_LABEL } from '@/lib/saas/stripe-subscription-checkout'

export const runtime = 'nodejs'

const WEBHOOK_ENDPOINT = '/api/payments/stripe/webhook'

export async function POST(request: Request) {
  const response = await handleEvent(request)

  // Registro para /superadmin/system-health: solo resultado y código HTTP,
  // después de responder y sin poder afectar el procesamiento.
  const status = response.status
  const errorMessage = status >= 400
    ? await response.clone().json().then((body: { error?: string }) => body.error ?? null).catch(() => null)
    : null
  after(() => recordWebhookEvent({ provider: 'stripe', endpoint: WEBHOOK_ENDPOINT, status, errorMessage }))

  return response
}

function getSessionReference(session: Stripe.Checkout.Session) {
  return session.metadata?.subscription_payment_reference || session.client_reference_id || null
}

function getPaymentIntentId(session: Stripe.Checkout.Session) {
  if (!session.payment_intent) return session.id
  return typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id
}

async function handleEvent(request: Request) {
  const signature = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    return NextResponse.json({ error: 'Stripe webhook not configured' }, { status: 501 })
  }
  if (!signature) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  // La firma se calcula sobre el cuerpo crudo: no parsear antes de verificar.
  const rawBody = await request.text()
  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object
      // Con medios asíncronos "completed" llega antes del cobro; se aplica
      // recién en async_payment_succeeded.
      if (session.payment_status !== 'paid') {
        return NextResponse.json({ success: true, applied: false, status: 'pending' })
      }
      return applyPaidSession(session)
    }
    case 'checkout.session.expired':
    case 'checkout.session.async_payment_failed':
      return markSessionFailed(event.data.object)
    default:
      return NextResponse.json({ success: true, ignored: event.type })
  }
}

async function applyPaidSession(session: Stripe.Checkout.Session) {
  const reference = getSessionReference(session)
  if (!reference) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
  if (session.amount_total == null || !session.currency) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const { data, error } = await admin.rpc('apply_paid_provider_subscription_payment', {
    p_provider: 'stripe',
    p_external_reference: reference,
    p_provider_payment_id: getPaymentIntentId(session),
    p_payment_method: STRIPE_PAYMENT_METHOD_LABEL,
    p_paid_at: new Date().toISOString(),
    p_amount: fromStripeUnitAmount(session.amount_total, session.currency),
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const result = Array.isArray(data) ? data[0] : data
  if (!result) {
    return NextResponse.json({ error: 'Payment was not applied' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    applied: result.applied === true,
    plan: result.plan_id,
  })
}

async function markSessionFailed(session: Stripe.Checkout.Session) {
  const reference = getSessionReference(session)
  if (!reference) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const { data: payment, error } = await admin
    .from('subscription_payments')
    .update({ status: 'failed' })
    .eq('provider', 'stripe')
    .eq('external_reference', reference)
    // Nunca degradar un pago ya confirmado.
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, applied: false, status: payment ? 'failed' : 'unchanged' })
}

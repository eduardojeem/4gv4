import { NextResponse, after } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { recordWebhookEvent } from '@/lib/health/webhook-log'
import { sendSubscriptionPaymentReceipt } from '@/lib/saas/subscription-notifications'
import { BANCARD_CARD_PAYMENT_METHOD } from '@/lib/saas/subscription-checkout'
import {
  isBancardConfigured,
  isBancardConfirmationApproved,
  isValidBancardShopProcessId,
  parseBancardConfirmation,
  validateBancardConfirmToken,
} from '@/lib/payments/bancard'

/**
 * Confirmación de pagos de Bancard vPOS. Esta URL se carga en el portal de
 * comercios de Bancard ("URL de confirmación"). Bancard la llama al terminar
 * cada pago único (aprobado o rechazado) y espera `{"status":"success"}`.
 */

const WEBHOOK_ENDPOINT = '/api/payments/bancard/webhook'

type BancardNotification = {
  operation?: Record<string, unknown> & {
    token?: unknown
    amount?: unknown
    currency?: unknown
    shop_process_id?: unknown
  }
}

export async function POST(request: Request) {
  const response = await handleNotification(request)

  // Registro para /superadmin/system-health: solo resultado y código HTTP,
  // después de responder y sin poder afectar el procesamiento.
  const status = response.status
  const errorMessage = status >= 400
    ? await response.clone().json().then((body: { error?: string }) => body.error ?? null).catch(() => null)
    : null
  after(() => recordWebhookEvent({ provider: 'bancard', endpoint: WEBHOOK_ENDPOINT, status, errorMessage }))

  return response
}

function acknowledge() {
  return NextResponse.json({ status: 'success' })
}

async function handleNotification(request: Request) {
  if (!isBancardConfigured()) {
    return NextResponse.json({ error: 'Bancard is not configured' }, { status: 501 })
  }

  const payload = await request.json().catch(() => null) as BancardNotification | null
  const operation = payload?.operation
  const confirmation = parseBancardConfirmation(operation)
  const token = typeof operation?.token === 'string' ? operation.token : ''
  const rawAmount = typeof operation?.amount === 'string' ? operation.amount : ''
  const currency = typeof operation?.currency === 'string' ? operation.currency : ''

  if (!confirmation || !token || !rawAmount || !currency || !isValidBancardShopProcessId(confirmation.shopProcessId)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  if (!validateBancardConfirmToken({ shopProcessId: confirmation.shopProcessId, amount: rawAmount, currency, token })) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
  }

  if (confirmation.amount === null) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const { data: payment, error: lookupError } = await admin
    .from('subscription_payments')
    .select('id, status, payment_method')
    .eq('provider', 'bancard')
    .eq('external_reference', confirmation.shopProcessId)
    .maybeSingle()

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 })
  }
  if (!payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  if (isBancardConfirmationApproved(confirmation)) {
    const { data, error } = await admin.rpc('apply_paid_provider_subscription_payment', {
      p_provider: 'bancard',
      p_external_reference: confirmation.shopProcessId,
      p_provider_payment_id: confirmation.authorizationNumber || confirmation.ticketNumber || '',
      p_payment_method: payment.payment_method || BANCARD_CARD_PAYMENT_METHOD,
      p_paid_at: new Date().toISOString(),
      p_amount: confirmation.amount,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const result = Array.isArray(data) ? data[0] : data
    if (!result) {
      return NextResponse.json({ error: 'Payment was not applied' }, { status: 500 })
    }
    if (result.applied === true && result.payment_id) {
      after(() => sendSubscriptionPaymentReceipt(result.payment_id))
    }
    return acknowledge()
  }

  // Rechazado por la tarjeta o el banco. Un pago ya aplicado no vuelve atrás
  // por una notificación: las anulaciones se registran desde el superadmin.
  if (payment.status === 'pending') {
    const { error } = await admin
      .from('subscription_payments')
      .update({ status: 'failed' })
      .eq('id', payment.id)
      .eq('status', 'pending')
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return acknowledge()
}

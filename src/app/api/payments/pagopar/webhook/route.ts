import { NextResponse, after } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { recordWebhookEvent } from '@/lib/health/webhook-log'
import { notifySubscriptionChargeback, sendSubscriptionPaymentReceipt } from '@/lib/saas/subscription-notifications'
import {
  parsePagoparNotificationAmount,
  queryPagoparOrder,
  validatePagoparNotificationToken,
} from '@/lib/payments/pagopar'

type PagoparNotificationItem = {
  pagado?: boolean
  cancelado?: boolean
  fecha_pago?: string | null
  forma_pago?: string | null
  hash_pedido?: string | null
  monto?: string | number | null
  numero_pedido?: string | number | null
  token?: string | null
}

type PagoparNotification = {
  resultado?: PagoparNotificationItem[]
}

function parsePaidAt(value: string | null | undefined) {
  if (!value) return new Date().toISOString()
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString()
}

const WEBHOOK_ENDPOINT = '/api/payments/pagopar/webhook'

export async function POST(request: Request) {
  const response = await handleNotification(request)

  // Registro para /superadmin/system-health: solo resultado y código HTTP,
  // después de responder y sin poder afectar el procesamiento.
  const status = response.status
  const errorMessage = status >= 400
    ? await response.clone().json().then((body: { error?: string }) => body.error ?? null).catch(() => null)
    : null
  after(() => recordWebhookEvent({ provider: 'pagopar', endpoint: WEBHOOK_ENDPOINT, status, errorMessage }))

  return response
}

async function handleNotification(request: Request) {
  const payload = await request.json().catch(() => null) as PagoparNotification | null
  const item = Array.isArray(payload?.resultado) ? payload.resultado[0] : undefined

  if (!payload || !item?.hash_pedido || !item?.token) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  if (!validatePagoparNotificationToken(item.hash_pedido, item.token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
  }

  const amount = item.monto == null ? null : parsePagoparNotificationAmount(item.monto)
  if ((item.monto != null && amount === null) || (item.pagado === true && amount === null)) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const providerPaymentId = item.numero_pedido ? String(item.numero_pedido) : ''
  const paymentMethod = item.forma_pago || 'Pagopar'

  if (item.pagado === true) {
    const { data, error } = await admin.rpc('apply_paid_subscription_payment', {
      p_external_reference: item.hash_pedido,
      p_provider_payment_id: providerPaymentId,
      p_payment_method: paymentMethod,
      p_paid_at: parsePaidAt(item.fecha_pago),
      p_amount: amount,
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

    return acknowledge(payload)
  }

  const { data: payment, error: lookupError } = await admin
    .from('subscription_payments')
    .select('id, status')
    .eq('provider', 'pagopar')
    .eq('external_reference', item.hash_pedido)
    .maybeSingle()

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 })
  }
  if (!payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  // Un pago ya aplicado no vuelve atrás por una notificación: si Pagopar
  // reversó el cobro, la suscripción se corrige a mano.
  // Un pago ya aplicado que Pagopar notifica como no pagado es una reversión o
  // un contracargo. No se confía solo en la notificación: se confirma
  // consultando el pedido y recién ahí se registra y se quita el período.
  if (payment.status === 'paid') {
    after(() => handlePagoparReversal(payment.id, item.hash_pedido as string))
    return acknowledge(payload)
  }

  const { error } = await admin
    .from('subscription_payments')
    .update({
      status: item.cancelado === true ? 'failed' : 'pending',
      payment_method: paymentMethod,
      provider_payment_id: providerPaymentId || null,
    })
    .eq('id', payment.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return acknowledge(payload)
}

async function handlePagoparReversal(paymentId: string, hash: string) {
  try {
    const order = await queryPagoparOrder(hash)
    // Solo un pedido cancelado o rechazado es una reversión. Si Pagopar lo
    // sigue dando por pagado, o todavía lo está procesando, no se toca nada.
    if (order.status !== 'cancelled' && order.status !== 'rejected') {
      console.warn('[pagopar-webhook] Notificación sin pago, pero Pagopar no confirma la reversión.', { paymentId, status: order.status })
      return
    }
    const { data, error } = await createAdminSupabase().rpc('refund_subscription_payment', {
      p_actor_id: null,
      p_payment_id: paymentId,
      p_reason: 'Reversión o contracargo informado por Pagopar',
      p_revoke_access: true,
      p_chargeback: true,
    })
    if (error) {
      console.error('[pagopar-webhook] No se pudo registrar la reversión.', { paymentId, code: error.code })
      return
    }
    await notifySubscriptionChargeback(data as { id: string; organization_id: string; amount: number })
  } catch (error) {
    console.error('[pagopar-webhook] No se pudo verificar la reversión.', { paymentId, error })
  }
}

/**
 * Pagopar da la notificación por recibida solo si se le devuelve el mismo
 * `resultado` que envió; con cualquier otra respuesta la sigue reintentando.
 */
function acknowledge(payload: PagoparNotification) {
  return NextResponse.json(payload.resultado)
}

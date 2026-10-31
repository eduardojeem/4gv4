import { NextResponse, after } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { recordWebhookEvent } from '@/lib/health/webhook-log'
import {
  parsePagoparNotificationAmount,
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
  if (payment.status === 'paid') {
    console.warn('[pagopar-webhook] Notificación sin pago para un pago ya aplicado.', {
      paymentId: payment.id,
      cancelled: item.cancelado === true,
    })
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

/**
 * Pagopar da la notificación por recibida solo si se le devuelve el mismo
 * `resultado` que envió; con cualquier otra respuesta la sigue reintentando.
 */
function acknowledge(payload: PagoparNotification) {
  return NextResponse.json(payload.resultado)
}

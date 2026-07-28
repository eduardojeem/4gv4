import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
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

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null) as PagoparNotification | null
  const item = payload?.resultado?.[0]

  if (!item?.hash_pedido || !item?.token) {
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

    return NextResponse.json({
      success: true,
      applied: result.applied === true,
      plan: result.plan_id,
    })
  }

  const status = item.cancelado === true ? 'failed' : 'pending'
  const { data: payment, error } = await admin
    .from('subscription_payments')
    .update({
      status,
      payment_method: paymentMethod,
      provider_payment_id: providerPaymentId || null,
    })
    .eq('provider', 'pagopar')
    .eq('external_reference', item.hash_pedido)
    .select('id')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, applied: false, status })
}

import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { validatePagoparNotificationToken } from '@/lib/payments/pagopar'

type PagoparNotificationItem = {
  pagado?: boolean
  cancelado?: boolean
  fecha_pago?: string | null
  forma_pago?: string | null
  hash_pedido?: string | null
  monto?: string | number | null
  numero_comprobante_interno?: string | null
  numero_pedido?: string | number | null
  token?: string | null
}

type PagoparNotification = {
  respuesta?: boolean
  resultado?: PagoparNotificationItem[]
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

  const admin = createAdminSupabase()
  const paid = item.pagado === true
  const status = paid ? 'paid' : item.cancelado ? 'failed' : 'pending'
  const paidDate = paid && item.fecha_pago ? new Date(item.fecha_pago) : null
  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + 1)
  const paidAt = paidDate && Number.isFinite(paidDate.getTime()) ? paidDate.toISOString() : paid ? now.toISOString() : null

  const { data: payment } = await admin
    .from('subscription_payments')
    .update({
      status,
      payment_method: item.forma_pago || 'Pagopar',
      provider_payment_id: item.numero_pedido ? String(item.numero_pedido) : null,
      paid_at: paidAt,
    })
    .eq('external_reference', item.hash_pedido)
    .select('organization_id, subscription_id')
    .maybeSingle()

  if (payment?.organization_id) {
    const subscriptionUpdate = {
      status: paid ? 'active' : 'past_due',
      payment_status: status,
      last_payment_method: item.forma_pago || 'Pagopar',
      external_reference: item.hash_pedido,
      provider_subscription_id: item.hash_pedido,
      updated_at: now.toISOString(),
      ...(paid
        ? {
            current_period_starts_at: now.toISOString(),
            current_period_ends_at: periodEnd.toISOString(),
            started_at: now.toISOString(),
          }
        : {}),
    }

    await admin
      .from('subscriptions')
      .update(subscriptionUpdate)
      .eq('organization_id', payment.organization_id)
  }

  return NextResponse.json(payload?.resultado || [])
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { logger } from '@/lib/logger'
import { normalizeOrderStatus } from '@/lib/orders/flow'
import { normalizeOrder } from '@/lib/orders/helpers'
import {
  canTransitionPaymentStatus,
  getInvalidPaymentTransitionMessage,
  normalizePaymentStatus,
} from '@/lib/orders/payment-flow'
import type { PaymentStatus } from '@/lib/orders/types'
import { createClient } from '@/lib/supabase/server'

const paymentSchema = z.object({
  payment_status: z.enum(['PAID', 'PARTIAL', 'REFUNDED', 'FAILED']),
  note: z.string().trim().max(1000).optional().nullable(),
})

async function getRouteId(routeContext: unknown) {
  const params = (routeContext as { params?: { id?: string } | Promise<{ id?: string }> } | undefined)?.params
  const resolved = (params && typeof (params as Promise<{ id?: string }>).then === 'function'
    ? await params
    : params) as { id?: string } | undefined
  return resolved?.id
}

export const PATCH = withTenantAuth({ permission: 'ecommerce.orders.manage' }, async (request, { user, organization }, routeContext) => {
  try {
    const id = await getRouteId(routeContext)
    if (!id) return NextResponse.json({ success: false, error: 'Order ID required' }, { status: 400 })

    const validation = paymentSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.issues }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: current, error: currentError } = await supabase
      .from('customer_orders')
      .select('status, payment_status, payment_method, total')
      .eq('id', id)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (currentError) throw currentError
    if (!current) return NextResponse.json({ success: false, error: 'Pedido no encontrado.' }, { status: 404 })

    const orderStatus = normalizeOrderStatus(current.status)
    const fromPaymentStatus = normalizePaymentStatus(current.payment_status)
    const toPaymentStatus = validation.data.payment_status

    if (!canTransitionPaymentStatus(orderStatus, fromPaymentStatus, toPaymentStatus)) {
      return NextResponse.json({
        success: false,
        error: getInvalidPaymentTransitionMessage(orderStatus, fromPaymentStatus, toPaymentStatus),
      }, { status: 409 })
    }

    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('customer_orders')
      .update({
        payment_status: toPaymentStatus,
        updated_at: now,
      })
      .eq('id', id)
      .eq('organization_id', organization.id)
      .select('*, order_items:customer_order_items(*)')
      .single()

    if (error) throw error

    const { error: historyError } = await supabase.from('customer_order_payment_history').insert({
      organization_id: organization.id,
      order_id: id,
      from_status: fromPaymentStatus,
      to_status: toPaymentStatus,
      payment_method: current.payment_method ? String(current.payment_method).toUpperCase() : null,
      amount: toPaymentStatus === 'PAID' ? Number(current.total || 0) : null,
      note: validation.data.note || null,
      changed_by: user.id,
      created_at: now,
    })

    if (historyError) {
      logger.warn('Order payment history insert failed', {
        error: historyError,
        orderId: id,
        fromPaymentStatus,
        toPaymentStatus,
      })
    }

    return NextResponse.json({ success: true, data: normalizeOrder(data) })
  } catch (error) {
    logger.error('Orders payment API error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo actualizar el pago.' }, { status: 500 })
  }
})

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { logger } from '@/lib/logger'
import { normalizeOrder } from '@/lib/orders/helpers'
import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'

const paymentSchema = z.object({
  collectionAmount: z.coerce.number().positive().max(999_999_999_999),
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER', 'DIGITAL_WALLET']),
  paymentReference: z.string().trim().max(160).optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
  idempotencyKey: z.string().uuid(),
}).superRefine((value, context) => {
  if (value.paymentMethod !== 'CASH' && !value.paymentReference) {
    context.addIssue({ code: 'custom', path: ['paymentReference'], message: 'Ingresá la referencia o comprobante.' })
  }
})

async function getRouteId(routeContext: unknown) {
  const params = (routeContext as { params?: { id?: string } | Promise<{ id?: string }> } | undefined)?.params
  const resolved = (params && typeof (params as Promise<{ id?: string }>).then === 'function'
    ? await params
    : params) as { id?: string } | undefined
  return resolved?.id
}

export const PATCH = withTenantAuth({ permission: 'ecommerce.orders.manage', module: 'orders' }, async (request, { user, organization }, routeContext) => {
  try {
    const id = await getRouteId(routeContext)
    if (!id) return NextResponse.json({ success: false, error: 'Order ID required' }, { status: 400 })

    const validation = paymentSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Error de validación', details: validation.error.issues }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: current, error: currentError } = await supabase
      .from('customer_orders')
      .select('status, payment_status, total, collected_amount, store_credit_reserved, store_credit_applied')
      .eq('id', id)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (currentError) throw currentError
    if (!current) return NextResponse.json({ success: false, error: 'Pedido no encontrado.' }, { status: 404 })

    const amountDue = Math.max(
      0,
      Number(current.total || 0)
        - Number(current.collected_amount || 0)
        - Number(current.store_credit_reserved || 0)
        - Number(current.store_credit_applied || 0)
    )
    if (validation.data.collectionAmount > amountDue) {
      return NextResponse.json({
        success: false,
        error: `El monto supera el saldo pendiente de Gs. ${amountDue.toLocaleString('es-PY')}.`,
      }, { status: 422 })
    }

    const admin = createAdminSupabase()
    const { error: paymentError } = await admin.rpc('record_customer_order_collection_atomic', {
      p_organization_id: organization.id,
      p_order_id: id,
      p_actor_id: user.id,
      p_amount: validation.data.collectionAmount,
      p_payment_method: validation.data.paymentMethod,
      p_payment_reference: validation.data.paymentReference || null,
      p_note: validation.data.note || null,
      p_idempotency_key: validation.data.idempotencyKey,
    })
    if (paymentError) {
      const safeMessage = paymentError.message.includes('PAYMENT_EXCEEDS_AMOUNT_DUE')
        ? 'El monto supera el saldo pendiente.'
        : paymentError.message.includes('PAYMENT_REFERENCE_REQUIRED')
          ? 'Ingresá la referencia o comprobante.'
          : paymentError.message.includes('ORDER_ALREADY_CANCELLED')
            ? 'No se pueden registrar cobros en un pedido cancelado.'
            : null
      if (safeMessage) return NextResponse.json({ success: false, error: safeMessage }, { status: 422 })
      throw paymentError
    }

    const { data, error } = await supabase
      .from('customer_orders')
      .select('*, order_items:customer_order_items(*)')
      .eq('id', id)
      .eq('organization_id', organization.id)
      .single()
    if (error) throw error

    return NextResponse.json({ success: true, data: normalizeOrder(data) })
  } catch (error) {
    logger.error('Orders payment API error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo actualizar el pago.' }, { status: 500 })
  }
})

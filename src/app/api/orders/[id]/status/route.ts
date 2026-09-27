import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { logger } from '@/lib/logger'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { canTransitionOrderStatus, normalizeOrderStatus } from '@/lib/orders/flow'
import { normalizeOrder } from '@/lib/orders/helpers'

const statusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  note: z.string().trim().max(1000).optional().nullable(),
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

    const validation = statusSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Error de validación', details: validation.error.issues }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: current, error: currentError } = await supabase
      .from('customer_orders')
      .select('status, fulfillment_type, order_number, store_credit_reserved, total, stock_reserved')
      .eq('id', id)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (currentError) throw currentError
    if (!current) return NextResponse.json({ success: false, error: 'Pedido no encontrado.' }, { status: 404 })

    const status = validation.data.status
    const currentStatus = normalizeOrderStatus(current.status)

    if (!canTransitionOrderStatus(currentStatus, status, current.fulfillment_type)) {
      return NextResponse.json({
        success: false,
        error: `Transicion invalida de ${currentStatus} a ${status}.`,
      }, { status: 409 })
    }

    const adminSupabase = createAdminSupabase()

    if (status === 'CANCELLED' && currentStatus !== 'CANCELLED') {
      const { error: cancellationError } = await adminSupabase.rpc(
        'cancel_customer_order_atomic',
        {
          p_organization_id: organization.id,
          p_order_id: id,
          p_actor_id: user.id,
          p_note: validation.data.note || null,
        }
      )

      if (cancellationError) {
        logger.warn('cancel_customer_order_atomic error, falling back to direct update', { error: cancellationError })
        // Fallback: release store credit reservations if any
        await adminSupabase
          .from('customer_store_credit_reservations')
          .update({ status: 'released', released_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('organization_id', organization.id)
          .eq('order_id', id)
          .eq('status', 'reserved')

        // Release inventory stock if reserved
        if (current.stock_reserved) {
          const { data: items } = await adminSupabase
            .from('customer_order_items')
            .select('product_id, variant_id, quantity')
            .eq('order_id', id)

          if (items && items.length > 0) {
            for (const item of items) {
              if (item.variant_id) {
                const { data: variant } = await adminSupabase
                  .from('product_variants')
                  .select('stock_quantity')
                  .eq('id', item.variant_id)
                  .single()
                if (variant) {
                  await adminSupabase
                    .from('product_variants')
                    .update({ stock_quantity: (variant.stock_quantity || 0) + Number(item.quantity) })
                    .eq('id', item.variant_id)
                }
              }
            }
          }
        }

        const { error: directCancelErr } = await adminSupabase
          .from('customer_orders')
          .update({
            status: 'CANCELLED',
            cancelled_at: new Date().toISOString(),
            stock_reserved: false,
            store_credit_reserved: 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('organization_id', organization.id)

        if (directCancelErr) throw directCancelErr

        await adminSupabase.from('customer_order_status_history').insert({
          organization_id: organization.id,
          order_id: id,
          from_status: current.status,
          to_status: 'CANCELLED',
          note: validation.data.note || null,
          changed_by: user.id,
        })
      }

      const { data: cancelledOrder, error: cancelledOrderError } = await supabase
        .from('customer_orders')
        .select('*, order_items:customer_order_items(*)')
        .eq('id', id)
        .eq('organization_id', organization.id)
        .single()

      if (cancelledOrderError) throw cancelledOrderError
      return NextResponse.json({ success: true, data: normalizeOrder(cancelledOrder) })
    }

    if (status === 'CONFIRMED' && currentStatus !== 'CONFIRMED') {
      const { error: confirmationError } = await adminSupabase.rpc(
        'confirm_customer_order_from_pending_atomic',
        {
          p_organization_id: organization.id,
          p_order_id: id,
          p_actor_id: user.id,
          p_note: validation.data.note || null,
        }
      )

      if (confirmationError) {
        logger.warn('confirm_customer_order_from_pending_atomic error, falling back to direct update', { error: confirmationError })
        // Fallback: apply store credit if reserved
        const reservedCredit = Number(current.store_credit_reserved || 0)
        let appliedAmount = 0
        if (reservedCredit > 0) {
          const { data: reservation } = await adminSupabase
            .from('customer_store_credit_reservations')
            .select('*')
            .eq('organization_id', organization.id)
            .eq('order_id', id)
            .eq('status', 'reserved')
            .maybeSingle()

          if (reservation) {
            appliedAmount = Number(reservation.amount || 0)
            await adminSupabase.from('customer_store_credits').insert({
              organization_id: organization.id,
              customer_id: reservation.customer_id,
              amount: -appliedAmount,
              reason: `Aplicado al pedido ${current.order_number}`,
              source_type: 'order',
              source_id: id,
              created_by: user.id,
            })
            await adminSupabase
              .from('customer_store_credit_reservations')
              .update({ status: 'consumed', consumed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
              .eq('id', reservation.id)
          }
        }

        const newPaymentStatus = appliedAmount >= Number(current.total || 0)
          ? 'PAID'
          : appliedAmount > 0
            ? 'PARTIAL'
            : undefined

        const updatePayload: Record<string, unknown> = {
          status: 'CONFIRMED',
          store_credit_reserved: 0,
          store_credit_applied: appliedAmount,
          updated_at: new Date().toISOString(),
        }
        if (newPaymentStatus) updatePayload.payment_status = newPaymentStatus

        const { error: directConfirmErr } = await adminSupabase
          .from('customer_orders')
          .update(updatePayload)
          .eq('id', id)
          .eq('organization_id', organization.id)

        if (directConfirmErr) throw directConfirmErr

        await adminSupabase.from('customer_order_status_history').insert({
          organization_id: organization.id,
          order_id: id,
          from_status: current.status,
          to_status: 'CONFIRMED',
          note: validation.data.note || 'Pedido confirmado desde el panel.',
          changed_by: user.id,
        })
      }

      const { data: confirmedOrder, error: confirmedOrderError } = await supabase
        .from('customer_orders')
        .select('*, order_items:customer_order_items(*)')
        .eq('id', id)
        .eq('organization_id', organization.id)
        .single()

      if (confirmedOrderError) throw confirmedOrderError
      return NextResponse.json({ success: true, data: normalizeOrder(confirmedOrder) })
    }

    const { error: advanceError } = await adminSupabase.rpc('advance_customer_order_status_atomic', {
      p_organization_id: organization.id, p_order_id: id, p_actor_id: user.id,
      p_to_status: status, p_note: validation.data.note || null,
    })

    if (advanceError) {
      logger.warn('advance_customer_order_status_atomic error, falling back to direct update', { error: advanceError })
      const updatePayload: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      }
      if (status === 'DELIVERED') {
        updatePayload.delivered_at = new Date().toISOString()
      }

      const { error: directAdvanceErr } = await adminSupabase
        .from('customer_orders')
        .update(updatePayload)
        .eq('id', id)
        .eq('organization_id', organization.id)

      if (directAdvanceErr) throw directAdvanceErr

      await adminSupabase.from('customer_order_status_history').insert({
        organization_id: organization.id,
        order_id: id,
        from_status: current.status,
        to_status: status,
        note: validation.data.note || null,
        changed_by: user.id,
      })
    }

    const { data, error } = await supabase.from('customer_orders')
      .select('*, order_items:customer_order_items(*)')
      .eq('id', id).eq('organization_id', organization.id).single()
    if (error) throw error

    return NextResponse.json({ success: true, data: normalizeOrder(data) })
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : String((error as { message?: unknown } | null)?.message ?? 'No se pudo cambiar el estado.')
    logger.error('Orders status API error', { error, message })
    return NextResponse.json({ success: false, error: message || 'No se pudo cambiar el estado.' }, { status: 500 })
  }
})

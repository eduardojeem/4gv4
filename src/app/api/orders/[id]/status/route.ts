import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { logger } from '@/lib/logger'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { canTransitionOrderStatus, normalizeOrderStatus } from '@/lib/orders/flow'
import { normalizeOrder } from '@/lib/orders/helpers'
import { releaseReservedStock } from '@/lib/orders/stock'
import type { OrderStatus } from '@/lib/orders/types'

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

export const PATCH = withTenantAuth({ permission: 'ecommerce.orders.manage' }, async (request, { user, organization }, routeContext) => {
  try {
    const id = await getRouteId(routeContext)
    if (!id) return NextResponse.json({ success: false, error: 'Order ID required' }, { status: 400 })

    const validation = statusSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.issues }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: current, error: currentError } = await supabase
      .from('customer_orders')
      .select('status')
      .eq('id', id)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (currentError) throw currentError
    if (!current) return NextResponse.json({ success: false, error: 'Pedido no encontrado.' }, { status: 404 })

    const status = validation.data.status
    const currentStatus = normalizeOrderStatus(current.status)

    if (!canTransitionOrderStatus(currentStatus, status)) {
      return NextResponse.json({
        success: false,
        error: `Transicion invalida de ${currentStatus} a ${status}.`,
      }, { status: 409 })
    }

    let shouldReleaseStock = false
    if (status === 'CANCELLED' && currentStatus !== 'CANCELLED') {
      const { data: stockData, error: stockError } = await supabase
        .from('customer_orders')
        .select('stock_reserved, order_items:customer_order_items(product_id, product_name, quantity)')
        .eq('id', id)
        .eq('organization_id', organization.id)
        .maybeSingle()

      if (stockError) {
        logger.warn('Order stock reservation lookup failed during cancellation', { error: stockError, orderId: id })
      } else if (stockData?.stock_reserved) {
        await releaseReservedStock(createAdminSupabase(), organization.id, stockData.order_items ?? [])
        shouldReleaseStock = true
      }
    }

    const now = new Date().toISOString()
    const terminalDates: Record<string, string | null> = {}
    if (status === 'DELIVERED' && currentStatus !== 'DELIVERED') {
      terminalDates.delivered_at = now
    }
    if (status === 'CANCELLED' && currentStatus !== 'CANCELLED') {
      terminalDates.cancelled_at = now
    }

    const { data, error } = await supabase
      .from('customer_orders')
      .update({
        status,
        ...terminalDates,
        ...(shouldReleaseStock ? { stock_reserved: false } : {}),
        updated_at: now,
      })
      .eq('id', id)
      .eq('organization_id', organization.id)
      .select('*, order_items:customer_order_items(*)')
      .single()

    if (error) throw error

    const { error: historyError } = await supabase.from('customer_order_status_history').insert({
      organization_id: organization.id,
      order_id: id,
      from_status: currentStatus,
      to_status: status,
      note: validation.data.note || null,
      changed_by: user.id,
    })
    if (historyError) {
      logger.warn('Order status history insert failed', { error: historyError, orderId: id, fromStatus: currentStatus, toStatus: status })
    }

    return NextResponse.json({ success: true, data: normalizeOrder(data) })
  } catch (error) {
    logger.error('Orders status API error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo cambiar el estado.' }, { status: 500 })
  }
})

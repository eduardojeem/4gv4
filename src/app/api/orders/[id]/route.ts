import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import { normalizeOrder } from '@/lib/orders/helpers'

const updateOrderSchema = z.object({
  payment_status: z.enum(['PENDING', 'PAID', 'PARTIAL', 'REFUNDED', 'FAILED']).optional(),
  payment_method: z.enum(['CASH', 'CARD', 'TRANSFER', 'DIGITAL_WALLET']).optional(),
  fulfillment_type: z.enum(['PICKUP', 'DELIVERY']).optional(),
  customer_name: z.string().trim().min(1).max(200).optional(),
  customer_email: z.string().trim().email().optional().or(z.literal('')).nullable(),
  customer_phone: z.string().trim().max(50).optional().nullable(),
  customer_address: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  shipping_cost: z.number().min(0).optional(),
  discount_amount: z.number().min(0).optional(),
})

async function getRouteId(routeContext: unknown) {
  const params = (routeContext as { params?: { id?: string } | Promise<{ id?: string }> } | undefined)?.params
  const resolved = (params && typeof (params as Promise<{ id?: string }>).then === 'function'
    ? await params
    : params) as { id?: string } | undefined
  return resolved?.id
}

export const GET = withTenantAuth({ permission: 'ecommerce.orders.manage' }, async (_request, { organization }, routeContext) => {
  try {
    const id = await getRouteId(routeContext)
    if (!id) return NextResponse.json({ success: false, error: 'Order ID required' }, { status: 400 })

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('customer_orders')
      .select('*, order_items:customer_order_items(*)')
      .eq('id', id)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ success: false, error: 'Pedido no encontrado.' }, { status: 404 })

    return NextResponse.json({ success: true, data: normalizeOrder(data) })
  } catch (error) {
    logger.error('Orders API detail error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo cargar el pedido.' }, { status: 500 })
  }
})

export const PUT = withTenantAuth({ permission: 'ecommerce.orders.manage' }, async (request, { organization }, routeContext) => {
  try {
    const id = await getRouteId(routeContext)
    if (!id) return NextResponse.json({ success: false, error: 'Order ID required' }, { status: 400 })

    const validation = updateOrderSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.issues }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: current, error: currentError } = await supabase
      .from('customer_orders')
      .select('subtotal, shipping_cost, discount_amount')
      .eq('id', id)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (currentError) throw currentError
    if (!current) return NextResponse.json({ success: false, error: 'Pedido no encontrado.' }, { status: 404 })

    const updates = validation.data
    const subtotal = Number(current.subtotal || 0)

    // Only recompute total when shipping or discount are explicitly changed
    const needsTotalUpdate = 'shipping_cost' in updates || 'discount_amount' in updates
    const shipping = updates.shipping_cost ?? Number(current.shipping_cost || 0)
    const discount = updates.discount_amount ?? Number(current.discount_amount || 0)
    const totalPatch = needsTotalUpdate
      ? { total: Math.max(0, subtotal + Number(shipping) - Number(discount)) }
      : {}

    const { data, error } = await supabase
      .from('customer_orders')
      .update({
        ...updates,
        ...totalPatch,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', organization.id)
      .select('*, order_items:customer_order_items(*)')
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data: normalizeOrder(data) })
  } catch (error) {
    logger.error('Orders API update error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo actualizar el pedido.' }, { status: 500 })
  }
})

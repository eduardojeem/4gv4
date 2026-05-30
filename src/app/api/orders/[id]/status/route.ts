import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
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
      .single()

    if (currentError) throw currentError

    const status = validation.data.status
    const now = new Date().toISOString()
    // Only set terminal dates when transitioning INTO that status, never clear them
    const terminalDates: Record<string, string | null> = {}
    if (status === 'DELIVERED' && current.status !== 'DELIVERED') {
      terminalDates.delivered_at = now
    }
    if (status === 'CANCELLED' && current.status !== 'CANCELLED') {
      terminalDates.cancelled_at = now
    }

    const { data, error } = await supabase
      .from('customer_orders')
      .update({
        status,
        ...terminalDates,
        updated_at: now,
      })
      .eq('id', id)
      .eq('organization_id', organization.id)
      .select('*, order_items:customer_order_items(*)')
      .single()

    if (error) throw error

    await supabase.from('customer_order_status_history').insert({
      organization_id: organization.id,
      order_id: id,
      from_status: current.status,
      to_status: status,
      note: validation.data.note || null,
      changed_by: user.id,
    })

    return NextResponse.json({ success: true, data: normalizeOrder(data) })
  } catch (error) {
    logger.error('Orders status API error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo cambiar el estado.' }, { status: 500 })
  }
})

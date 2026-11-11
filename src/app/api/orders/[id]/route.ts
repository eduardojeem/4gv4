import { assertCommercePayments } from '@/lib/payments/control-store'
import { PaymentControlError } from '@/lib/payments/control-contract'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import { validateDeliveryContact, validateOrderAmounts } from '@/lib/orders/creation-rules'
import { normalizeOrder } from '@/lib/orders/helpers'
import type { FulfillmentType } from '@/lib/orders/types'
import { getOrganizationPlanInfo } from '@/lib/saas/subscription-service'

const updateOrderSchema = z.object({
  payment_method: z.enum(['CASH', 'CARD', 'TRANSFER', 'DIGITAL_WALLET']).optional(),
  fulfillment_type: z.enum(['PICKUP', 'DELIVERY']).optional(),
  customer_name: z.string().trim().min(1).max(200).optional(),
  customer_email: z.string().trim().email().optional().or(z.string().trim().max(0)).nullable(),
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

export const GET = withTenantAuth({ permission: 'ecommerce.orders.manage', module: 'orders' }, async (_request, { organization }, routeContext) => {
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

export const PUT = withTenantAuth({ permission: 'ecommerce.orders.manage', module: 'orders' }, async (request, { organization }, routeContext) => {
  try {
    const id = await getRouteId(routeContext)
    if (!id) return NextResponse.json({ success: false, error: 'Order ID required' }, { status: 400 })

    const validation = updateOrderSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Error de validación', details: validation.error.issues }, { status: 400 })
    }

    const updates = validation.data
    if (updates.payment_method) {
      await assertCommercePayments(organization.id, [{ method: updates.payment_method }])
    }

    if (updates.fulfillment_type === 'DELIVERY') {
      const { effectiveModules } = await getOrganizationPlanInfo(organization.id)
      if (!effectiveModules.includes('delivery')) {
        return NextResponse.json({
          success: false,
          error: 'Las entregas están desactivadas para esta organización.',
          code: 'DELIVERY_MODULE_DISABLED',
        }, { status: 403 })
      }
    }

    const supabase = await createClient()
    const { data: current, error: currentError } = await supabase
      .from('customer_orders')
      .select('subtotal, shipping_cost, discount_amount, status, payment_status, fulfillment_type, customer_phone, customer_address')
      .eq('id', id)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (currentError) throw currentError
    if (!current) return NextResponse.json({ success: false, error: 'Pedido no encontrado.' }, { status: 404 })

    const changesMoney = 'shipping_cost' in updates || 'discount_amount' in updates
    const financialLocked = current.payment_status !== 'PENDING' || ['DELIVERED', 'CANCELLED'].includes(String(current.status))
    if (changesMoney && financialLocked) {
      return NextResponse.json({
        success: false,
        code: 'ORDER_FINANCIAL_EDIT_LOCKED',
        error: 'No se pueden modificar importes después del pago, entrega o cancelación. Usá una corrección auditable.',
      }, { status: 409 })
    }

    const nextFulfillment = (updates.fulfillment_type ?? current.fulfillment_type ?? 'PICKUP') as FulfillmentType
    const nextPhone = 'customer_phone' in updates ? (updates.customer_phone?.trim() || null) : (current.customer_phone ?? null)
    const nextAddress = 'customer_address' in updates ? (updates.customer_address?.trim() || null) : (current.customer_address ?? null)

    const deliveryError = validateDeliveryContact({
      fulfillmentType: nextFulfillment,
      phone: nextPhone,
      address: nextAddress,
    })
    if (deliveryError) {
      return NextResponse.json({ success: false, error: deliveryError }, { status: 400 })
    }

    const subtotal = Number(current.subtotal || 0)
    const nextShipping = updates.shipping_cost !== undefined
      ? updates.shipping_cost
      : (updates.fulfillment_type === 'PICKUP' && !financialLocked ? 0 : Number(current.shipping_cost || 0))
    const nextDiscount = updates.discount_amount ?? Number(current.discount_amount || 0)

    if (changesMoney || updates.fulfillment_type !== undefined) {
      const amountsError = validateOrderAmounts({
        subtotal,
        shippingCost: Number(nextShipping),
        discountAmount: Number(nextDiscount),
        fulfillmentType: nextFulfillment,
      })
      if (amountsError) {
        return NextResponse.json({ success: false, error: amountsError }, { status: 400 })
      }
    }

    const normalizedUpdates = {
      ...updates,
      ...('customer_email' in updates ? { customer_email: updates.customer_email?.trim() || null } : {}),
      ...('customer_phone' in updates ? { customer_phone: nextPhone } : {}),
      ...('customer_address' in updates ? { customer_address: nextAddress } : {}),
      ...('notes' in updates ? { notes: updates.notes?.trim() || null } : {}),
      ...(updates.fulfillment_type === 'PICKUP' && !financialLocked && updates.shipping_cost === undefined && Number(current.shipping_cost || 0) > 0
        ? { shipping_cost: 0 }
        : {}),
    }

    // Only recompute total when shipping or discount changed (including auto-zero on PICKUP)
    const needsTotalUpdate = changesMoney || ('shipping_cost' in normalizedUpdates)
    const totalPatch = needsTotalUpdate
      ? { total: Math.max(0, subtotal + Number(nextShipping) - Number(nextDiscount)) }
      : {}

    const { data, error } = await supabase
      .from('customer_orders')
      .update({
        ...normalizedUpdates,
        ...totalPatch,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', organization.id)
      .select('*, order_items:customer_order_items(*)')
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data: normalizeOrder(data) })
  } catch (error: unknown) {
    if (error instanceof PaymentControlError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    logger.error('Orders API update error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo actualizar el pedido.' }, { status: 500 })
  }
})

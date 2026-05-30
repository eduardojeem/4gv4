import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { generateOrderNumber, normalizeOrder } from '@/lib/orders/helpers'
import { resolvePublicOrganization } from '@/lib/saas/public-tenant'
import { rateLimiter, getClientIp } from '@/lib/rate-limiter'

// 5 pedidos por IP cada 10 minutos — amplio para uso legítimo, eficaz contra bots
const ORDER_RATE_LIMIT = 5
const ORDER_RATE_WINDOW_MS = 10 * 60 * 1000

const publicOrderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().email().optional().or(z.literal('')).nullable(),
    phone: z.string().trim().max(50).optional().nullable(),
    address: z.string().trim().max(500).optional().nullable(),
  }),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1).max(999),
  })).min(1),
  fulfillmentType: z.enum(['PICKUP', 'DELIVERY']).default('PICKUP'),
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER', 'DIGITAL_WALLET']).default('CASH'),
  notes: z.string().trim().max(1000).optional().nullable(),
})

export async function POST(request: NextRequest) {
  // ── Rate limiting ────────────────────────────────────────────────────────
  const clientIp = getClientIp(request)
  const allowed = rateLimiter.check(clientIp, ORDER_RATE_LIMIT, ORDER_RATE_WINDOW_MS)
  if (!allowed) {
    const retryAfter = rateLimiter.getResetTime(clientIp)
    logger.warn('[orders] Rate limit exceeded', { clientIp })
    return NextResponse.json(
      { success: false, error: 'Demasiados pedidos. Intenta de nuevo en unos minutos.' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      }
    )
  }

  try {
    const validation = publicOrderSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.issues }, { status: 400 })
    }

    const input = validation.data
    const supabase = createAdminSupabase()
    const organization = await resolvePublicOrganization(request, supabase)

    if (!organization) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 })
    }

    const productIds = input.items.map((item) => item.productId)
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, sku, sale_price, has_offer, offer_price, stock_quantity, is_active')
      .eq('organization_id', organization.id)
      .eq('is_active', true)
      .in('id', productIds)

    if (productsError) throw productsError

    const productMap = new Map((products ?? []).map((product) => [String(product.id), product]))
    const missing = productIds.find((id) => !productMap.has(id))
    if (missing) {
      return NextResponse.json({ success: false, error: 'Un producto del carrito ya no esta disponible.' }, { status: 400 })
    }

    const orderItems = input.items.map((item) => {
      const product = productMap.get(item.productId) as Record<string, unknown>
      const stock = Number(product.stock_quantity || 0)
      if (stock <= 0) {
        throw new Error(`${String(product.name)} no tiene stock disponible.`)
      }

      const quantity = Math.min(item.quantity, stock)

      // Use offer_price only when the offer flag is explicitly enabled and
      // the offer price is lower than the regular sale price.
      const salePrice = Number(product.sale_price || 0)
      const hasOffer =
        Boolean(product.has_offer) &&
        product.offer_price != null &&
        Number(product.offer_price) < salePrice
      const unitPrice = hasOffer ? Number(product.offer_price) : salePrice

      return {
        product_id: item.productId,
        product_name: String(product.name ?? 'Producto'),
        product_sku: product.sku ? String(product.sku) : null,
        quantity,
        unit_price: unitPrice,
        subtotal: unitPrice * quantity,
      }
    })

    const now = new Date().toISOString()
    const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0)

    let customerId: string | null = null
    const normalizedEmail = input.customer.email?.trim().toLowerCase() || null
    const normalizedPhone = input.customer.phone?.trim() || ''

    if (normalizedEmail || normalizedPhone) {
      let customerQuery = supabase
        .from('customers')
        .select('id')
        .eq('organization_id', organization.id)
        .limit(1)

      customerQuery = normalizedEmail
        ? customerQuery.ilike('email', normalizedEmail)
        : customerQuery.eq('phone', normalizedPhone)

      const { data: existingCustomer } = await customerQuery.maybeSingle()
      customerId = existingCustomer?.id ?? null
    }

    if (!customerId) {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert({
          organization_id: organization.id,
          name: input.customer.name,
          email: normalizedEmail,
          phone: normalizedPhone,
          address: input.customer.address || null,
          status: 'active',
          customer_type: 'regular',
          created_at: now,
          updated_at: now,
        })
        .select('id')
        .single()

      if (customerError) throw customerError
      customerId = customer.id
    }

    const { data: order, error: orderError } = await supabase
      .from('customer_orders')
      .insert({
        organization_id: organization.id,
        customer_id: customerId,
        order_number: generateOrderNumber(),
        status: 'PENDING',
        payment_status: 'PENDING',
        payment_method: input.paymentMethod,
        fulfillment_type: input.fulfillmentType,
        customer_name: input.customer.name,
        customer_email: normalizedEmail,
        customer_phone: normalizedPhone || null,
        customer_address: input.customer.address || null,
        subtotal,
        shipping_cost: 0,
        discount_amount: 0,
        tax_amount: 0,
        total: subtotal,
        notes: input.notes || null,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single()

    if (orderError) throw orderError

    const { error: itemsError } = await supabase
      .from('customer_order_items')
      .insert(orderItems.map((item) => ({
        ...item,
        organization_id: organization.id,
        order_id: order.id,
      })))

    if (itemsError) throw itemsError

    // ── Atomically decrement stock for each item ─────────────────────────────
    // Uses a DB function with SELECT FOR UPDATE so two simultaneous orders
    // cannot both pass the stock check for the same unit.
    const decrementResults = await Promise.all(
      orderItems.map(async (item) => {
        const { data: ok, error: decrementError } = await supabase.rpc(
          'decrement_product_stock',
          {
            p_product_id:      item.product_id,
            p_organization_id: organization.id,
            p_quantity:        item.quantity,
          }
        )
        if (decrementError) {
          logger.warn('[orders] Stock decrement error', {
            productId: item.product_id,
            quantity:  item.quantity,
            error:     decrementError.message,
          })
        }
        return { productId: item.product_id, quantity: item.quantity, ok: Boolean(ok) }
      })
    )

    const failedDecrements = decrementResults.filter((r) => !r.ok)
    if (failedDecrements.length > 0) {
      logger.warn('[orders] Stock depleted by concurrent order', {
        orderId:  order.id,
        failures: failedDecrements,
      })
      // Order is still valid — the business owner is notified via the log.
      // Rare race condition: both orders arrived before either decremented.
    }

    await supabase.from('customer_order_status_history').insert({
      organization_id: organization.id,
      order_id: order.id,
      to_status: 'PENDING',
      note: 'Pedido creado desde la tienda publica.',
    })

    const { data: fullOrder } = await supabase
      .from('customer_orders')
      .select('*, order_items:customer_order_items(*)')
      .eq('id', order.id)
      .eq('organization_id', organization.id)
      .single()

    return NextResponse.json({ success: true, data: normalizeOrder(fullOrder ?? order) }, { status: 201 })
  } catch (error) {
    logger.error('Public order creation error', { error })
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'No se pudo crear el pedido.' },
      { status: 500 }
    )
  }
}

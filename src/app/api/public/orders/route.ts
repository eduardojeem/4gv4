import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { generateOrderNumber, normalizeOrder } from '@/lib/orders/helpers'
import { resolvePublicStorefrontOrganization } from '@/lib/saas/public-tenant'
import { rateLimiter, getClientIp } from '@/lib/rate-limiter'
import { applyAutomaticPromotionToProduct, evaluatePublicCoupon, mapPublicPromotion, type PublicPromotion } from '@/lib/public-promotions'
import { resolveWholesaleStatus } from '@/lib/api/products-server'
import { resolvePublicUnitPrice } from '@/lib/orders/public-pricing'
import { applyWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { getDeliveryCost } from '@/lib/checkout/delivery-cost'
import type { CheckoutSettings } from '@/types/website-settings'

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
  })).min(1).max(50),
  fulfillmentType: z.enum(['PICKUP', 'DELIVERY']).default('PICKUP'),
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER', 'DIGITAL_WALLET']).default('CASH'),
  shippingCost: z.number().min(0).max(9_999_999).default(0),
  storeCreditAmount: z.number().finite().min(0).max(9_999_999).default(0),
  deliveryZoneId: z.string().max(100).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  promotionCode: z.string().trim().max(80).optional().nullable(),
})

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request)
  const allowed = rateLimiter.check(clientIp, ORDER_RATE_LIMIT, ORDER_RATE_WINDOW_MS)
  if (!allowed) {
    const retryAfter = rateLimiter.getResetTime(clientIp)
    logger.warn('[orders] Rate limit exceeded', { clientIp })
    return NextResponse.json(
      { success: false, error: 'Demasiados pedidos. Intenta de nuevo en unos minutos.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  try {
    const supabase = createAdminSupabase()
    const validation = publicOrderSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Error de validación', details: validation.error.issues }, { status: 400 })
    }

    const input = validation.data
    const organization = await resolvePublicStorefrontOrganization(request, supabase)

    if (!organization) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 })
    }

    const { data: checkoutSetting, error: checkoutSettingError } = await supabase
      .from('website_settings')
      .select('value')
      .eq('organization_id', organization.id)
      .eq('key', 'checkout')
      .maybeSingle()

    if (checkoutSettingError) throw checkoutSettingError

    const checkout = applyWebsiteSettingsDefaults(
      checkoutSetting?.value
        ? { checkout: checkoutSetting.value as CheckoutSettings }
        : {}
    ).checkout

    if (checkout.commerceMode !== 'cart') {
      return NextResponse.json(
        { success: false, error: 'La tienda no tiene habilitados los pedidos por carrito.' },
        { status: 403 }
      )
    }

    const requestedByProduct = new Map<string, number>()
    for (const item of input.items) {
      requestedByProduct.set(
        item.productId,
        (requestedByProduct.get(item.productId) ?? 0) + item.quantity
      )
    }
    const requestedItems = Array.from(requestedByProduct, ([productId, quantity]) => ({
      productId,
      quantity,
    }))
    const productIds = requestedItems.map((item) => item.productId)

    // El catálogo le muestra al mayorista su propio precio y los productos de
    // visibilidad mayorista. El checkout tiene que resolver lo mismo o cobra de
    // más y deja pedir productos que el cliente no debería ver.
    const authSupabase = await createClient()
    const { data: { user: storefrontUser } } = await authSupabase.auth.getUser()
    const { isWholesale } = await resolveWholesaleStatus({
      supabase: authSupabase,
      user: storefrontUser ?? null,
      organizationId: organization.id,
    })

    // Nunca se selecciona wholesale_price para un cliente minorista.
    const productSelect = isWholesale
      ? 'id, name, sku, category_id, sale_price, wholesale_price, has_offer, offer_price, stock_quantity, is_active'
      : 'id, name, sku, category_id, sale_price, has_offer, offer_price, stock_quantity, is_active'

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select(productSelect as '*')
      .eq('organization_id', organization.id)
      .eq('is_active', true)
      .in('visibility', isWholesale ? ['public', 'wholesale'] : ['public'])
      .in('id', productIds)

    if (productsError) throw productsError

    const productMap = new Map((products ?? []).map((product) => [String(product.id), product]))
    const missing = productIds.find((id) => !productMap.has(id))
    if (missing) {
      return NextResponse.json({ success: false, error: 'Un producto del carrito ya no esta disponible.' }, { status: 400 })
    }

    const stockConflicts = requestedItems.flatMap((item) => {
      const product = productMap.get(item.productId) as Record<string, unknown>
      const available = Math.max(0, Number(product.stock_quantity || 0))
      return item.quantity > available
        ? [{
            productId: item.productId,
            name: String(product.name ?? 'Producto'),
            requested: item.quantity,
            available,
          }]
        : []
    })

    if (stockConflicts.length > 0) {
      return NextResponse.json({
        success: false,
        code: 'STOCK_CHANGED',
        error: 'Actualizamos el carrito porque cambió el stock disponible.',
        data: { conflicts: stockConflicts },
      }, { status: 409 })
    }

    const { data: automaticRows } = await supabase
      .from('promotions')
      .select('*')
      .eq('organization_id', organization.id)
      .eq('public_mode', 'automatic')
      .eq('is_active', true)
    const automaticPromotions = (automaticRows ?? []).map((row) => mapPublicPromotion(row as Record<string, unknown>))

    const orderItems = requestedItems.map((item) => {
      const product = productMap.get(item.productId) as Record<string, unknown>
      const priced = applyAutomaticPromotionToProduct({
        id: item.productId,
        category_id: product.category_id ? String(product.category_id) : null,
        sale_price: Number(product.sale_price || 0),
        has_offer: Boolean(product.has_offer),
        offer_price: product.offer_price == null ? null : Number(product.offer_price),
      }, automaticPromotions)
      const unitPrice = resolvePublicUnitPrice({
        isWholesale,
        wholesalePrice: product.wholesale_price == null ? null : Number(product.wholesale_price),
        salePrice: priced.sale_price,
        hasOffer: Boolean(priced.has_offer),
        offerPrice: priced.offer_price ?? null,
      })

      return {
        product_id: item.productId,
        product_name: String(product.name ?? 'Producto'),
        product_sku: product.sku ? String(product.sku) : null,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal: unitPrice * item.quantity,
        category_id: product.category_id ? String(product.category_id) : null,
      }
    })
    const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0)

    if (input.fulfillmentType === 'DELIVERY' && !checkout.delivery.enabled) {
      return NextResponse.json({ success: false, error: 'El delivery no está disponible.' }, { status: 422 })
    }
    if (input.fulfillmentType === 'PICKUP' && !checkout.pickup.enabled) {
      return NextResponse.json({ success: false, error: 'El retiro en local no está disponible.' }, { status: 422 })
    }

    const deliveryZones = checkout.delivery.zoneOptions ?? []
    const selectedDeliveryZone = deliveryZones.find((zone) => zone.id === input.deliveryZoneId)
    if (input.fulfillmentType === 'DELIVERY' && deliveryZones.length > 0 && !selectedDeliveryZone) {
      return NextResponse.json({ success: false, error: 'Seleccioná una zona de delivery válida.' }, { status: 422 })
    }

    const shippingCost = getDeliveryCost({
      fulfillmentType: input.fulfillmentType,
      subtotal,
      defaultCost: checkout.delivery.defaultCost,
      selectedZoneCost: selectedDeliveryZone?.cost,
      freeThreshold: checkout.delivery.freeThreshold,
    })

    let appliedPromotion: PublicPromotion | null = null
    let discountAmount = 0
    if (input.promotionCode) {
      const { data: promotionRow } = await supabase
        .from('promotions')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('code', input.promotionCode.toUpperCase())
        .maybeSingle()
      if (!promotionRow) {
        return NextResponse.json({ success: false, error: 'Código promocional inválido.' }, { status: 422 })
      }
      appliedPromotion = mapPublicPromotion(promotionRow as Record<string, unknown>)
      const result = evaluatePublicCoupon(appliedPromotion, orderItems.map((item) => ({
        product_id: item.product_id,
        category_id: item.category_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })))
      if (!result.valid) return NextResponse.json({ success: false, error: result.reason }, { status: 422 })
      discountAmount = result.discount_amount
    }

    const normalizedEmail = input.customer.email?.trim().toLowerCase() || null
    const normalizedPhone = input.customer.phone?.trim() || ''
    let customerId: string | null = null
    const authClient = await createClient()
    const { data: { user: buyer } } = await authClient.auth.getUser()

    if (input.storeCreditAmount > 0 && !buyer) {
      return NextResponse.json({
        success: false,
        code: 'STORE_CREDIT_PROFILE_REQUIRED',
        error: 'Iniciá sesión para usar tu saldo a favor.',
      }, { status: 401 })
    }

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

    const orderNumber = generateOrderNumber()
    const notes = [input.notes, appliedPromotion ? `Cupón: ${appliedPromotion.code}` : null]
      .filter(Boolean)
      .join(' · ') || null
    const total = Math.max(0, subtotal + shippingCost - discountAmount)

    const { data: atomicResult, error: atomicError } = await supabase.rpc(
      'create_public_order_with_store_credit_atomic',
      {
        p_organization_id: organization.id,
        p_customer_id: customerId,
        p_customer: {
          name: input.customer.name,
          email: normalizedEmail,
          phone: normalizedPhone,
          address: input.customer.address || null,
        },
        p_order: {
          order_number: orderNumber,
          payment_method: input.paymentMethod,
          fulfillment_type: input.fulfillmentType,
          subtotal,
          shipping_cost: shippingCost,
          discount_amount: discountAmount,
          total,
          notes,
        },
        p_items: orderItems,
        p_promotion_id: appliedPromotion?.id ?? null,
        p_profile_id: buyer?.id ?? null,
        p_profile_name: buyer
          ? String(buyer.user_metadata?.full_name || buyer.user_metadata?.name || input.customer.name)
          : null,
        p_profile_email: buyer?.email || normalizedEmail,
        p_profile_phone: buyer
          ? String(buyer.user_metadata?.phone || buyer.phone || normalizedPhone).trim()
          : normalizedPhone,
        p_store_credit_amount: input.storeCreditAmount,
      }
    )

    if (atomicError) throw atomicError

    const created = atomicResult as { order_id?: string; customer_id?: string } | null
    if (!created?.order_id || !created.customer_id) {
      throw new Error('La base de datos no devolvió el pedido creado.')
    }
    customerId = created.customer_id

    const { data: fullOrder } = await supabase
      .from('customer_orders')
      .select('*, order_items:customer_order_items(*)')
      .eq('id', created.order_id)
      .eq('organization_id', organization.id)
      .single()

    if (!fullOrder) throw new Error('No se pudo recuperar el pedido creado.')
    return NextResponse.json({ success: true, data: normalizeOrder(fullOrder) }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : String((error as { message?: unknown } | null)?.message ?? '')
    const stockMatch = message.match(/STOCK_CHANGED\|([0-9a-f-]+)\|(\d+)/i)
    if (stockMatch) {
      return NextResponse.json({
        success: false,
        code: 'STOCK_CHANGED',
        error: 'El stock cambió mientras confirmabas. Revisá la cantidad disponible.',
        data: {
          conflicts: [{
            productId: stockMatch[1],
            available: Number(stockMatch[2]),
          }],
        },
      }, { status: 409 })
    }
    if (message.includes('PROMOTION_LIMIT_REACHED')) {
      return NextResponse.json({
        success: false,
        error: 'El código promocional alcanzó su límite de usos.',
      }, { status: 409 })
    }
    if (message.includes('STORE_CREDIT_EXCEEDS_AVAILABLE')) {
      return NextResponse.json({
        success: false,
        code: 'STORE_CREDIT_EXCEEDS_AVAILABLE',
        error: 'El saldo solicitado supera tu saldo disponible. Actualizá el importe e intentá nuevamente.',
      }, { status: 409 })
    }
    if (message.includes('STORE_CREDIT_PROFILE_REQUIRED')) {
      return NextResponse.json({
        success: false,
        code: 'STORE_CREDIT_PROFILE_REQUIRED',
        error: 'Iniciá sesión con la cuenta vinculada al cliente para usar el saldo a favor.',
      }, { status: 401 })
    }
    if (message.includes('STORE_CREDIT_EXCEEDS_ORDER_TOTAL')) {
      return NextResponse.json({
        success: false,
        code: 'STORE_CREDIT_EXCEEDS_ORDER_TOTAL',
        error: 'El saldo a utilizar no puede superar el total del pedido.',
      }, { status: 422 })
    }

    logger.error('Public order creation error', { error })
    return NextResponse.json(
      { success: false, error: 'No se pudo crear el pedido.' },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { logger } from '@/lib/logger'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getOrderStatusDbValues, normalizeOrderStatus } from '@/lib/orders/flow'
import { sendEmail } from '@/lib/email/resend'
import { renderOrderConfirmationEmail } from '@/lib/email/templates'
import { generateOrderNumber, normalizeOrder, sanitizeOrderSearch } from '@/lib/orders/helpers'
import { releaseReservedStock, reserveOrderStock, type OrderStockItem } from '@/lib/orders/stock'
import {
  getCatalogUnitPrice,
  hasDuplicateProductIds,
  validateDeliveryContact,
  validateOrderAmounts,
} from '@/lib/orders/creation-rules'
import { loadBranchInventoryStockMap } from '@/lib/branches/inventory'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'
import type { AppRole } from '@/lib/auth/role-utils'
import type { FulfillmentType, PaymentMethod } from '@/lib/orders/types'

const STAT_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const
const STATUS_FILTERS = new Set<string>(STAT_STATUSES)
const PAYMENT_STATUS_FILTERS = new Set(['PENDING', 'PAID', 'PARTIAL', 'REFUNDED', 'FAILED'])

const orderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(1000),
}).strict()

const createOrderSchema = z.object({
  branchId: z.string().uuid().optional().nullable(),
  customerId: z.string().uuid().optional().nullable(),
  customer: z.object({
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().email().optional().or(z.literal('')).nullable(),
    phone: z.string().trim().max(50).optional().nullable(),
    address: z.string().trim().max(500).optional().nullable(),
  }).optional(),
  items: z.array(orderItemSchema).min(1),
  deliveryContact: z.object({
    phone: z.string().trim().max(50),
    address: z.string().trim().max(500),
  }).optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER', 'DIGITAL_WALLET']).default('CASH'),
  fulfillmentType: z.enum(['PICKUP', 'DELIVERY']).default('PICKUP'),
  shippingCost: z.number().min(0).max(999999999).default(0),
  discountAmount: z.number().min(0).max(999999999).default(0),
  notes: z.string().trim().max(2000).optional().nullable(),
}).superRefine((value, context) => {
  if (hasDuplicateProductIds(value.items)) {
    context.addIssue({
      code: 'custom',
      path: ['items'],
      message: 'No se puede repetir el mismo producto.',
    })
  }
})

export const GET = withTenantAuth({ permission: 'ecommerce.orders.manage' }, async (request, { organization }) => {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)))
    const requestedStatus = searchParams.get('status')
    const status = requestedStatus && requestedStatus !== 'ALL'
      ? normalizeOrderStatus(requestedStatus)
      : requestedStatus?.toUpperCase()
    const paymentStatus = searchParams.get('payment_status')?.toUpperCase()
    const fulfillmentType = searchParams.get('fulfillment_type')
    const search = sanitizeOrderSearch(searchParams.get('search') || '')
    const dateFrom = searchParams.get('date_from')
    const sort = searchParams.get('sort') || 'newest'
    const includeStats = searchParams.get('include_stats') === 'true'
    const from = (page - 1) * limit
    const to = from + limit - 1
    const supabase = await createClient()

    let query = supabase
      .from('customer_orders')
      .select('*, order_items:customer_order_items(*)', { count: 'exact' })
      .eq('organization_id', organization.id)

    if (status && status !== 'ALL' && STATUS_FILTERS.has(status)) {
      query = query.in('status', getOrderStatusDbValues(status as typeof STAT_STATUSES[number]))
    }
    if (paymentStatus && paymentStatus !== 'ALL' && PAYMENT_STATUS_FILTERS.has(paymentStatus)) {
      query = query.ilike('payment_status', paymentStatus)
    }
    if (fulfillmentType && fulfillmentType !== 'ALL') {
      query = query.eq('fulfillment_type', fulfillmentType)
    }
    if (search) {
      query = query.or(
        `order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_email.ilike.%${search}%,customer_phone.ilike.%${search}%`
      )
    }
    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }

    switch (sort) {
      case 'oldest':
        query = query.order('created_at', { ascending: true }); break
      case 'amount_desc':
        query = query.order('total', { ascending: false }); break
      case 'amount_asc':
        query = query.order('total', { ascending: true }); break
      default:
        query = query.order('created_at', { ascending: false })
    }

    const { data, error, count } = await query.range(from, to)
    if (error) throw error

    // Stats: use parallel HEAD-only COUNT queries instead of fetching all rows.
    // "today" metrics are computed org-wide (not from the paginated page) so the
    // dashboard cards stay accurate regardless of the active tab/filter.
    let stats: Record<string, number> | null = null
    let meta: { todayCount: number; todayRevenue: number } | null = null
    if (includeStats) {
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      const startOfTodayIso = startOfToday.toISOString()

      const [statsResults, todayCountResult, todayPaidResult] = await Promise.all([
        Promise.all(
          STAT_STATUSES.map((s) =>
            supabase
              .from('customer_orders')
              .select('*', { count: 'exact', head: true })
              .eq('organization_id', organization.id)
              .in('status', getOrderStatusDbValues(s))
          )
        ),
        supabase
          .from('customer_orders')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organization.id)
          .gte('created_at', startOfTodayIso),
        supabase
          .from('customer_orders')
          .select('total')
          .eq('organization_id', organization.id)
          .gte('created_at', startOfTodayIso)
          .ilike('payment_status', 'PAID'),
      ])

      stats = Object.fromEntries(STAT_STATUSES.map((s, i) => [s, statsResults[i].count ?? 0]))
      const todayRevenue = ((todayPaidResult.data ?? []) as Array<{ total: unknown }>)
        .reduce((sum, row) => sum + Number(row.total || 0), 0)
      meta = { todayCount: todayCountResult.count ?? 0, todayRevenue }
    }

    return NextResponse.json({
      success: true,
      data: {
        orders: (data ?? []).map((order) => normalizeOrder(order)),
        pagination: {
          page,
          limit,
          total: count ?? 0,
          totalPages: Math.max(1, Math.ceil((count ?? 0) / limit)),
        },
        stats,
        meta,
      },
    })
  } catch (error) {
    logger.error('Orders API GET error', { error })
    return NextResponse.json({ success: false, error: 'No se pudieron cargar los pedidos.' }, { status: 500 })
  }
})

export const POST = withTenantAuth({ permission: 'ecommerce.orders.manage' }, async (request, { user, organization }) => {
  try {
    const validation = createOrderSchema.safeParse(await request.json())

    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.issues }, { status: 400 })
    }

    const input = validation.data
    const supabase = await createClient()
    const requestedBranchId = getRequestedBranchId(request, input.branchId)
    let branchScope: Awaited<ReturnType<typeof resolveBranchScopeForUser>>
    try {
      branchScope = await resolveBranchScopeForUser({
        userId: user.id,
        role: user.role as AppRole | undefined,
        requestedBranchId,
        organizationId: organization.id,
        strict: Boolean(requestedBranchId),
      })
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'No se pudo validar la sucursal.',
      }, { status: 403 })
    }
    let customerId = input.customerId || null
    let createdCustomerId: string | null = null
    let customerSnapshot = input.customer ?? null

    if (customerId) {
      const { data: customer, error } = await supabase
        .from('customers')
        .select('id, name, email, phone, address')
        .eq('id', customerId)
        .eq('organization_id', organization.id)
        .maybeSingle()

      if (error) throw error
      if (!customer) {
        return NextResponse.json({ success: false, error: 'Cliente no encontrado.' }, { status: 404 })
      }

      customerSnapshot = {
        name: String(customer.name ?? ''),
        email: customer.email ? String(customer.email) : null,
        phone: customer.phone ? String(customer.phone) : null,
        address: customer.address ? String(customer.address) : null,
      }
    }

    if (!customerSnapshot) {
      return NextResponse.json({ success: false, error: 'El pedido necesita un cliente.' }, { status: 400 })
    }

    if (input.fulfillmentType === 'DELIVERY') {
      customerSnapshot = {
        ...customerSnapshot,
        phone: input.deliveryContact?.phone || customerSnapshot.phone || null,
        address: input.deliveryContact?.address || customerSnapshot.address || null,
      }
    }

    const deliveryError = validateDeliveryContact({
      fulfillmentType: input.fulfillmentType,
      phone: customerSnapshot.phone,
      address: customerSnapshot.address,
    })
    if (deliveryError) {
      return NextResponse.json({ success: false, error: deliveryError }, { status: 400 })
    }

    const productIds = input.items.map((item) => item.productId)
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, sku, sale_price, offer_price, stock_quantity')
      .eq('organization_id', organization.id)
      .in('id', productIds)

    if (productsError) throw productsError

    const baseProducts = (products ?? []) as Array<Record<string, unknown> & {
      id: string
      stock_quantity?: number | null
    }>
    const { stockMap, branchScoped } = await loadBranchInventoryStockMap(
      supabase as unknown as Parameters<typeof loadBranchInventoryStockMap>[0],
      branchScope.branchId,
      productIds
    )
    if (branchScope.branchId && !branchScoped) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo validar el inventario de la sucursal activa.',
      }, { status: 503 })
    }
    const scopedProducts: typeof baseProducts = branchScope.branchId
      ? baseProducts.map((product) => ({
          ...product,
          stock_quantity: Number(stockMap.get(product.id) || 0),
        }))
      : baseProducts
    const productMap = new Map<string, (typeof baseProducts)[number]>(
      scopedProducts.map((product) => [String(product.id), product] as const)
    )
    const missingProduct = productIds.find((id) => !productMap.has(id))
    if (missingProduct) {
      return NextResponse.json({ success: false, error: 'Uno de los productos no existe en esta empresa.' }, { status: 400 })
    }

    // Stock validation — only for products that track stock (stock_quantity !== null)
    for (const item of input.items) {
      const product = productMap.get(item.productId)!
      const stock = product.stock_quantity != null ? Number(product.stock_quantity) : null
      if (stock !== null && Number.isFinite(stock) && stock < item.quantity) {
        return NextResponse.json({
          success: false,
          error: `Stock insuficiente para "${product.name}". Disponible: ${stock} unidad${stock !== 1 ? 'es' : ''}.`,
        }, { status: 409 })
      }
    }

    const orderItems = input.items.map((item) => {
      const product = productMap.get(item.productId) as Record<string, unknown>
      const unitPrice = getCatalogUnitPrice(product)
      return {
        product_id: item.productId,
        product_name: String(product.name ?? 'Producto'),
        product_sku: product.sku ? String(product.sku) : null,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal: unitPrice * item.quantity,
      }
    })

    const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0)
    const amountsError = validateOrderAmounts({
      subtotal,
      shippingCost: input.shippingCost,
      discountAmount: input.discountAmount,
      fulfillmentType: input.fulfillmentType,
    })
    if (amountsError) {
      return NextResponse.json({ success: false, error: amountsError }, { status: 400 })
    }
    const total = subtotal + input.shippingCost - input.discountAmount
    const now = new Date().toISOString()
    const stockClient = createAdminSupabase()
    let reservedItems: OrderStockItem[] = []
    let createdOrderId: string | null = null

    const stockReservation = await reserveOrderStock(
      stockClient,
      organization.id,
      orderItems,
      branchScope.branchId
    )
    if (!stockReservation.success) {
      return NextResponse.json({ success: false, error: stockReservation.error }, { status: 409 })
    }

    reservedItems = stockReservation.reserved.map((item) => ({
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
    }))

    try {
      if (!customerId) {
        const { data: createdCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            organization_id: organization.id,
            name: customerSnapshot.name,
            email: customerSnapshot.email || null,
            phone: customerSnapshot.phone || '',
            address: customerSnapshot.address || null,
            status: 'active',
            customer_type: 'regular',
            created_at: now,
            updated_at: now,
          })
          .select('id')
          .single()

        if (customerError) throw customerError
        customerId = createdCustomer.id
        createdCustomerId = createdCustomer.id
      }

      const { data: order, error: orderError } = await supabase
      .from('customer_orders')
      .insert({
        organization_id: organization.id,
        branch_id: branchScope.branchId,
        customer_id: customerId,
        order_number: generateOrderNumber(),
        status: 'PENDING',
        payment_status: 'PENDING',
        payment_method: input.paymentMethod as PaymentMethod,
        fulfillment_type: input.fulfillmentType as FulfillmentType,
        customer_name: customerSnapshot.name,
        customer_email: customerSnapshot.email || null,
        customer_phone: customerSnapshot.phone || null,
        customer_address: customerSnapshot.address || null,
        subtotal,
        tax_amount: 0,
        shipping_cost: input.shippingCost,
        discount_amount: input.discountAmount,
        total,
        notes: input.notes || null,
        stock_reserved: true,
        created_by: user.id,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single()

      if (orderError) throw orderError
      createdOrderId = order.id

      const { error: itemsError } = await supabase
      .from('customer_order_items')
      .insert(orderItems.map((item) => ({
        ...item,
        organization_id: organization.id,
        order_id: order.id,
      })))

      if (itemsError) throw itemsError

      const { error: historyError } = await supabase.from('customer_order_status_history').insert({
      organization_id: organization.id,
      order_id: order.id,
      to_status: 'PENDING',
      note: 'Pedido creado desde el dashboard.',
      changed_by: user.id,
      })
      if (historyError) throw historyError

      const { data: fullOrder } = await supabase
      .from('customer_orders')
      .select('*, order_items:customer_order_items(*)')
      .eq('id', order.id)
      .eq('organization_id', organization.id)
      .single()

      // Send order confirmation email (non-blocking)
      if (order.customer_email) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const emailItems = ((fullOrder?.order_items ?? []) as Array<Record<string, unknown>>).map((item) => ({
          name: String(item.product_name || item.name || 'Producto'),
          quantity: Number(item.quantity || 1),
          price: Number(item.unit_price || item.price || 0),
        }))
        const trackUrl = `${appUrl}/${organization.slug}/track?orderNumber=${encodeURIComponent(order.order_number)}`
        sendEmail({
          to: order.customer_email,
          subject: `Pedido confirmado #${order.order_number}`,
          html: renderOrderConfirmationEmail({
            customerName: order.customer_name || 'Cliente',
            orderCode: order.order_number,
            items: emailItems,
            total: Number(order.total || 0),
            deliveryMethod: order.fulfillment_type === 'PICKUP' ? 'pickup' : 'delivery',
            trackUrl,
            brand: { name: organization.name },
          }),
          log: {
            organizationId: organization.id,
            customerName: order.customer_name || undefined,
          },
        }).catch((err) => logger.error('Failed to send order confirmation email', { error: err }))
      }

      return NextResponse.json({ success: true, data: normalizeOrder(fullOrder ?? order) }, { status: 201 })
    } catch (error) {
      if (createdOrderId) {
        const { error: cleanupOrderError } = await supabase
          .from('customer_orders')
          .delete()
          .eq('id', createdOrderId)
          .eq('organization_id', organization.id)
        if (cleanupOrderError) {
          logger.error('Failed to clean up a partially created order', {
            error: cleanupOrderError,
            orderId: createdOrderId,
          })
        }
      }
      if (reservedItems.length > 0) {
        try {
          await releaseReservedStock(
            stockClient,
            organization.id,
            reservedItems,
            branchScope.branchId
          )
        } catch (releaseError) {
          logger.error('Failed to release stock after order creation error', {
            error: releaseError,
            branchId: branchScope.branchId,
          })
        }
      }
      if (createdCustomerId) {
        const { error: cleanupCustomerError } = await supabase
          .from('customers')
          .delete()
          .eq('id', createdCustomerId)
          .eq('organization_id', organization.id)
        if (cleanupCustomerError) {
          logger.error('Failed to clean up a customer from a failed order', {
            error: cleanupCustomerError,
            customerId: createdCustomerId,
          })
        }
      }
      throw error
    }
  } catch (error) {
    logger.error('Orders API POST error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo crear el pedido.' }, { status: 500 })
  }
})

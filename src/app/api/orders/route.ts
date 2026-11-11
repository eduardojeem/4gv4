import { assertCommercePayments } from '@/lib/payments/control-store'
import { PaymentControlError } from '@/lib/payments/control-contract'
import { NextResponse } from 'next/server'
import { afterResponse, notifyOrderCreated } from '@/lib/notifications/server/business-events'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { logger } from '@/lib/logger'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getOrderStatusDbValues, normalizeOrderStatus } from '@/lib/orders/flow'
import { startOfDayInTimeZone } from '@/lib/date/timezone'
import { sendEmail } from '@/lib/email/resend'
import { renderOrderConfirmationEmail } from '@/lib/email/templates'
import { generateOrderNumber, normalizeOrder, sanitizeOrderSearch } from '@/lib/orders/helpers'
import {
  getCatalogUnitPrice,
  hasDuplicateOrderItems,
  validateDeliveryContact,
  validateOrderAmounts,
} from '@/lib/orders/creation-rules'
import { isServiceLikeProduct } from '@/lib/products/is-service-like'
import { loadVariantBranchStock } from '@/lib/products/variant-branch-stock'
import { resolvePublicVariantPrice } from '@/lib/public/offer-pricing'
import { loadBranchInventoryStockMap } from '@/lib/branches/inventory'
import { getRequestedBranchId, listAccessibleBranchesForUser, resolveBranchScopeForUser } from '@/lib/branches/server'
import type { AppRole } from '@/lib/auth/role-utils'
import type { FulfillmentType, PaymentMethod } from '@/lib/orders/types'
import { getOrganizationPlanInfo } from '@/lib/saas/subscription-service'

const STAT_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const
const STATUS_FILTERS = new Set<string>(STAT_STATUSES)
const PAYMENT_STATUS_FILTERS = new Set(['PENDING', 'PAID', 'PARTIAL', 'REFUNDED', 'FAILED'])

const orderItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional().nullable(),
  quantity: z.number().int().min(1).max(1000),
}).strict()

const createOrderSchema = z.object({
  branchId: z.string().uuid().optional().nullable(),
  idempotencyKey: z.string().trim().min(8).max(128).optional().nullable(),
  customerId: z.string().uuid().optional().nullable(),
  customer: z.object({
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().email().optional().or(z.string().trim().max(0)).nullable(),
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
  if (hasDuplicateOrderItems(value.items)) {
    context.addIssue({
      code: 'custom',
      path: ['items'],
      message: 'No se puede repetir el mismo producto o variante.',
    })
  }
})

const UUID_LIKE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const GET = withTenantAuth({ permission: 'ecommerce.orders.manage', module: 'orders' }, async (request, { user, organization }) => {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)))
    const requestedStatus = searchParams.get('status')
    const status = requestedStatus && requestedStatus !== 'ALL'
      ? normalizeOrderStatus(requestedStatus)
      : requestedStatus?.toUpperCase()
    const paymentStatus = searchParams.get('payment_status')?.toUpperCase()
    const fulfillmentType = searchParams.get('fulfillment_type')?.toUpperCase()
    const rawBranchFilter = (searchParams.get('branch_id') || searchParams.get('branchId') || '').trim()
    const search = sanitizeOrderSearch(searchParams.get('search') || '')
    const dateFrom = searchParams.get('date_from')
    const sort = searchParams.get('sort') || 'newest'
    const includeStats = searchParams.get('include_stats') === 'true'
    const from = (page - 1) * limit
    const to = from + limit - 1
    const supabase = await createClient()

    let specificBranchId: string | null = null
    let accessibleBranchIds: string[] | null = null

    if (rawBranchFilter && rawBranchFilter !== 'ALL') {
      if (!UUID_LIKE_RE.test(rawBranchFilter)) {
        return NextResponse.json({ success: false, error: 'Sucursal inválida.' }, { status: 400 })
      }
      try {
        const branchScope = await resolveBranchScopeForUser({
          userId: user.id,
          role: user.role as AppRole | undefined,
          requestedBranchId: rawBranchFilter,
          organizationId: organization.id,
          strict: true,
        })
        specificBranchId = branchScope.branchId
      } catch (err) {
        return NextResponse.json({
          success: false,
          error: err instanceof Error ? err.message : 'No autorizado para la sucursal solicitada.',
        }, { status: 403 })
      }
    } else {
      const isOrgWideRole =
        user.role === 'super_admin'
        || organization.role === 'owner'
        || organization.role === 'admin'
      if (!isOrgWideRole) {
        const accessible = await listAccessibleBranchesForUser({
          userId: user.id,
          role: user.role as AppRole | undefined,
          organizationId: organization.id,
        })
        accessibleBranchIds = accessible.map((branch) => branch.id)
      }
    }

    const applyBranchFilter = <T>(builder: T): T => {
      const q = builder as unknown as {
        eq: (col: string, val: string) => T
        or: (filters: string) => T
        is: (col: string, val: null) => T
      }
      if (specificBranchId) {
        return q.eq('branch_id', specificBranchId)
      }
      if (accessibleBranchIds !== null) {
        return accessibleBranchIds.length > 0
          ? q.or(`branch_id.is.null,branch_id.in.(${accessibleBranchIds.join(',')})`)
          : q.is('branch_id', null)
      }
      return builder
    }

    let query = applyBranchFilter(
      supabase
        .from('customer_orders')
        .select('*, order_items:customer_order_items(*)', { count: 'exact' })
        .eq('organization_id', organization.id)
    )

    if (status && status !== 'ALL' && STATUS_FILTERS.has(status)) {
      query = query.in('status', getOrderStatusDbValues(status as typeof STAT_STATUSES[number]))
    }
    if (paymentStatus && paymentStatus !== 'ALL' && PAYMENT_STATUS_FILTERS.has(paymentStatus)) {
      query = query.ilike('payment_status', paymentStatus)
    }
    if (fulfillmentType && fulfillmentType !== 'ALL' && (fulfillmentType === 'PICKUP' || fulfillmentType === 'DELIVERY')) {
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
    // "today" metrics follow the active branch scope so cards match the list context.
    let stats: Record<string, number> | null = null
    let meta: { todayCount: number; todayRevenue: number } | null = null
    if (includeStats) {
      // Day boundaries must resolve in the organization's zone, not the host's.
      const { data: orgRow, error: orgError } = await supabase
        .from('organization_settings')
        .select('timezone')
        .eq('organization_id', organization.id)
        .maybeSingle()

      if (orgError) {
        logger.warn('Organization timezone lookup failed for order stats', { error: orgError, organizationId: organization.id })
      }

      const startOfTodayIso = startOfDayInTimeZone(orgRow?.timezone as string | undefined).toISOString()

      const [statsResults, todayCountResult, todayPaidResult] = await Promise.all([
        Promise.all(
          STAT_STATUSES.map((s) =>
            applyBranchFilter(
              supabase
                .from('customer_orders')
                .select('*', { count: 'exact', head: true })
                .eq('organization_id', organization.id)
                .in('status', getOrderStatusDbValues(s))
            )
          )
        ),
        applyBranchFilter(
          supabase
            .from('customer_orders')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organization.id)
            .gte('created_at', startOfTodayIso)
        ),
        // "Cobrado hoy" is driven by when the collection occurred (PAID or PARTIAL),
        // not when the order was created.
        supabase
          .from('customer_order_payment_history')
          .select('amount, order_id')
          .eq('organization_id', organization.id)
          .in('to_status', ['PAID', 'PARTIAL'])
          .gt('amount', 0)
          .gte('created_at', startOfTodayIso),
      ])

      const statsError = statsResults.find((result) => result.error)?.error
      if (statsError) {
        logger.warn('Order status counts query failed', { error: statsError, organizationId: organization.id })
      }
      if (todayCountResult.error) {
        logger.warn('Today order count query failed', { error: todayCountResult.error, organizationId: organization.id })
      }
      if (todayPaidResult.error) {
        logger.warn('Today revenue query failed', { error: todayPaidResult.error, organizationId: organization.id })
      }

      stats = Object.fromEntries(STAT_STATUSES.map((s, i) => [s, statsResults[i].count ?? 0]))

      let paidRows = (todayPaidResult.data ?? []) as Array<{ amount: unknown; order_id?: string | null }>
      if ((specificBranchId || accessibleBranchIds !== null) && paidRows.length > 0) {
        const orderIds = [...new Set(paidRows.map((row) => row.order_id).filter((id): id is string => Boolean(id)))]
        if (orderIds.length > 0) {
          const { data: allowedOrders } = await applyBranchFilter(
            supabase
              .from('customer_orders')
              .select('id')
              .eq('organization_id', organization.id)
              .in('id', orderIds)
          )
          const allowedSet = new Set(((allowedOrders ?? []) as Array<{ id: string }>).map((row) => String(row.id)))
          paidRows = paidRows.filter((row) => row.order_id && allowedSet.has(String(row.order_id)))
        } else {
          paidRows = []
        }
      }

      const todayRevenue = paidRows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
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
    if (error instanceof PaymentControlError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    logger.error('Orders API GET error', { error })
    return NextResponse.json({ success: false, error: 'No se pudieron cargar los pedidos.' }, { status: 500 })
  }
})

export const POST = withTenantAuth({ permission: 'ecommerce.orders.manage', module: 'orders' }, async (request, { user, organization }) => {
  try {
    const rawHeaderIdempotencyKey = request.headers.get('x-idempotency-key')?.trim() || null
    if (
      rawHeaderIdempotencyKey
      && (rawHeaderIdempotencyKey.length < 8 || rawHeaderIdempotencyKey.length > 128)
    ) {
      return NextResponse.json(
        { success: false, error: 'La clave de idempotencia no es válida.' },
        { status: 400 }
      )
    }

    const validation = createOrderSchema.safeParse(await request.json())

    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Error de validación', details: validation.error.issues }, { status: 400 })
    }

    const input = validation.data
    const idempotencyKey = input.idempotencyKey || rawHeaderIdempotencyKey || null
    await assertCommercePayments(organization.id, [{ method: input.paymentMethod }])
    if (input.fulfillmentType === 'DELIVERY') {
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
    if (!branchScope.branchId) {
      return NextResponse.json({
        success: false,
        code: 'BRANCH_REQUIRED',
        error: 'No hay una sucursal activa asignada para registrar pedidos.',
      }, { status: 409 })
    }

    if (idempotencyKey) {
      const { data: existingOrder, error: existingOrderError } = await supabase
        .from('customer_orders')
        .select('*, order_items:customer_order_items(*)')
        .eq('organization_id', organization.id)
        .eq('creation_idempotency_key', idempotencyKey)
        .maybeSingle()

      if (existingOrderError) throw existingOrderError
      if (existingOrder) {
        return NextResponse.json(
          { success: true, data: normalizeOrder(existingOrder), idempotent: true },
          { status: 200 }
        )
      }
    }

    const customerId = input.customerId || null
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

    const uniqueProductIds = [...new Set(input.items.map((item) => item.productId))]
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, sku, sale_price, offer_price, has_offer, stock_quantity, unit_measure, has_variants, is_active, category:categories(name)')
      .eq('organization_id', organization.id)
      .in('id', uniqueProductIds)

    if (productsError) throw productsError

    const baseProducts = (products ?? []) as Array<Record<string, unknown> & {
      id: string
      name?: string | null
      sku?: string | null
      sale_price?: number | null
      offer_price?: number | null
      has_offer?: boolean | null
      stock_quantity?: number | null
      unit_measure?: string | null
      has_variants?: boolean | null
      is_active?: boolean | null
      category?: { name?: string | null } | null
    }>
    const baseProductMap = new Map<string, (typeof baseProducts)[number]>(
      baseProducts.map((product) => [String(product.id), product] as const)
    )
    const missingProduct = uniqueProductIds.find((id) => !baseProductMap.has(id))
    if (missingProduct) {
      return NextResponse.json({ success: false, error: 'Uno de los productos no existe en esta empresa.' }, { status: 400 })
    }
    const inactiveProduct = baseProducts.find((product) => product.is_active === false)
    if (inactiveProduct) {
      return NextResponse.json({
        success: false,
        error: `El producto "${inactiveProduct.name || 'Producto'}" está desactivado.`,
      }, { status: 409 })
    }

    const stockClient = createAdminSupabase()
    const { data: variantRows, error: variantsError } = await stockClient
      .from('product_variants')
      .select('id, product_id, variant_name, sku, sale_price, wholesale_price, stock_quantity, is_active')
      .eq('organization_id', organization.id)
      .in('product_id', uniqueProductIds)
      .eq('is_active', true)

    if (variantsError) throw variantsError

    const activeVariants = (variantRows ?? []) as Array<{
      id: string
      product_id: string
      variant_name?: string | null
      sku?: string | null
      sale_price?: number | null
      wholesale_price?: number | null
      stock_quantity?: number | null
      is_active?: boolean | null
    }>
    const variantMap = new Map(activeVariants.map((variant) => [String(variant.id), variant]))
    const activeVariantsByProduct = new Map<string, typeof activeVariants>()
    for (const variant of activeVariants) {
      const list = activeVariantsByProduct.get(String(variant.product_id)) ?? []
      list.push(variant)
      activeVariantsByProduct.set(String(variant.product_id), list)
    }

    for (const item of input.items) {
      const product = baseProductMap.get(item.productId)!
      const productVariants = activeVariantsByProduct.get(item.productId) ?? []
      if (!item.variantId) {
        if (product.has_variants === true && productVariants.length > 0) {
          return NextResponse.json({
            success: false,
            code: 'VARIANT_REQUIRED',
            error: `Elegí una variante para "${product.name || 'Producto'}".`,
          }, { status: 409 })
        }
        continue
      }
      const variant = variantMap.get(item.variantId)
      if (!variant || String(variant.product_id) !== item.productId) {
        return NextResponse.json({
          success: false,
          code: 'VARIANT_NOT_AVAILABLE',
          error: `La variante elegida de "${product.name || 'Producto'}" ya no está disponible.`,
        }, { status: 409 })
      }
    }

    const physicalVariantIds = [...new Set(
      input.items
        .filter((item) => {
          if (!item.variantId) return false
          const product = baseProductMap.get(item.productId)!
          return !isServiceLikeProduct(product)
        })
        .map((item) => item.variantId as string)
    )]
    const variantBranchStock = physicalVariantIds.length > 0
      ? await loadVariantBranchStock(stockClient, organization.id, branchScope.branchId, physicalVariantIds)
      : new Map<string, number>()

    const nonVariantPhysicalIds = [...new Set(
      input.items
        .filter((item) => {
          if (item.variantId) return false
          const product = baseProductMap.get(item.productId)!
          return !isServiceLikeProduct(product) && product.stock_quantity != null
        })
        .map((item) => item.productId)
    )]
    const { stockMap, branchScoped } = nonVariantPhysicalIds.length > 0
      ? await loadBranchInventoryStockMap(
          supabase as unknown as Parameters<typeof loadBranchInventoryStockMap>[0],
          branchScope.branchId,
          nonVariantPhysicalIds
        )
      : { stockMap: new Map<string, number>(), branchScoped: true }

    if (nonVariantPhysicalIds.length > 0 && !branchScoped) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo validar el inventario de la sucursal activa.',
      }, { status: 503 })
    }

    // Stock validation — services and untracked stock bypass inventory checks
    for (const item of input.items) {
      const product = baseProductMap.get(item.productId)!
      if (isServiceLikeProduct(product)) continue

      if (item.variantId) {
        const variant = variantMap.get(item.variantId)!
        if (!variantBranchStock.has(variant.id)) {
          return NextResponse.json({
            success: false,
            error: `La variante "${variant.variant_name || product.name || 'Variante'}" no tiene stock configurado en la sucursal seleccionada.`,
          }, { status: 409 })
        }
        const available = Number(variantBranchStock.get(variant.id) ?? 0)
        if (available < item.quantity) {
          return NextResponse.json({
            success: false,
            error: `Stock insuficiente para "${product.name} (${variant.variant_name || 'Variante'})". Disponible: ${available} unidad${available !== 1 ? 'es' : ''}.`,
          }, { status: 409 })
        }
        continue
      }

      if (product.stock_quantity == null) continue
      const stock = Number(stockMap.get(product.id) ?? 0)
      if (Number.isFinite(stock) && stock < item.quantity) {
        return NextResponse.json({
          success: false,
          error: `Stock insuficiente para "${product.name}". Disponible: ${stock} unidad${stock !== 1 ? 'es' : ''}.`,
        }, { status: 409 })
      }
    }

    const orderItems = input.items.map((item) => {
      const product = baseProductMap.get(item.productId)!
      const variant = item.variantId ? variantMap.get(item.variantId)! : null
      const unitPrice = variant
        ? resolvePublicVariantPrice({
            isWholesale: false,
            product: {
              sale_price: Number(product.sale_price || 0),
              offer_price: product.offer_price != null ? Number(product.offer_price) : null,
              has_offer: typeof product.has_offer === 'boolean' ? product.has_offer : null,
            },
            variant: {
              sale_price: Number(variant.sale_price || 0),
            },
          })
        : getCatalogUnitPrice(product)

      return {
        product_id: item.productId,
        variant_id: variant ? String(variant.id) : null,
        variant_name: variant?.variant_name ? String(variant.variant_name) : null,
        product_name: String(product.name ?? 'Producto'),
        product_sku: variant?.sku ? String(variant.sku) : (product.sku ? String(product.sku) : null),
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
    const orderNumber = generateOrderNumber()
    const { data: atomicResult, error: atomicError } = await stockClient.rpc(
      'create_dashboard_order_atomic',
      {
        p_organization_id: organization.id,
        p_branch_id: branchScope.branchId,
        p_actor_id: user.id,
        p_customer_id: customerId,
        p_customer: customerSnapshot,
        p_order: {
          order_number: orderNumber,
          payment_method: input.paymentMethod as PaymentMethod,
          fulfillment_type: input.fulfillmentType as FulfillmentType,
          subtotal,
          shipping_cost: input.shippingCost,
          discount_amount: input.discountAmount,
          total,
          notes: input.notes || null,
        },
        p_items: orderItems,
        p_idempotency_key: idempotencyKey,
      }
    )

    if (atomicError) {
      const msg = atomicError.message || 'No se pudo crear el pedido.'
      const isConflict =
        msg.includes('Insufficient stock')
        || msg.includes('VARIANT_STOCK_INSUFFICIENT')
        || msg.includes('Branch variant inventory not configured')
        || msg.includes('VARIANT_BRANCH_FORBIDDEN')
        || msg.includes('VARIANT_NOT_AVAILABLE')
      const friendlyError = msg.includes('VARIANT_NOT_AVAILABLE')
        ? 'Una de las variantes seleccionadas ya no está disponible.'
        : msg
      return NextResponse.json({ success: false, error: friendlyError }, { status: isConflict ? 409 : 400 })
    }

    const atomicPayload = atomicResult as { order_id?: string; replayed?: boolean } | null
    const createdOrderId = atomicPayload?.order_id
    const replayed = Boolean(atomicPayload?.replayed)
    if (!createdOrderId) {
      throw new Error('La base de datos no devolvio el pedido creado.')
    }

    const { data: fullOrder, error: fullOrderError } = await supabase
      .from('customer_orders')
      .select('*, order_items:customer_order_items(*)')
      .eq('id', createdOrderId)
      .eq('organization_id', organization.id)
      .single()

    if (fullOrderError) throw fullOrderError

    if (!replayed) {
      // Send order confirmation email (non-blocking)
      if (fullOrder.customer_email) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const emailItems = ((fullOrder?.order_items ?? []) as Array<Record<string, unknown>>).map((item) => ({
          name: `${String(item.product_name || item.name || 'Producto')}${item.variant_name ? ` (${String(item.variant_name)})` : ''}`,
          quantity: Number(item.quantity || 1),
          price: Number(item.unit_price || item.price || 0),
        }))
        const trackUrl = `${appUrl}/${organization.slug}/track?orderNumber=${encodeURIComponent(fullOrder.order_number)}`
        sendEmail({
          to: fullOrder.customer_email,
          subject: `Pedido confirmado #${fullOrder.order_number}`,
          html: renderOrderConfirmationEmail({
            customerName: fullOrder.customer_name || 'Cliente',
            orderCode: fullOrder.order_number,
            items: emailItems,
            total: Number(fullOrder.total || 0),
            deliveryMethod: fullOrder.fulfillment_type === 'PICKUP' ? 'pickup' : 'delivery',
            trackUrl,
            brand: { name: organization.name },
          }),
          log: {
            organizationId: organization.id,
            customerName: fullOrder.customer_name || undefined,
          },
        }).catch((err) => logger.error('Failed to send order confirmation email', { error: err }))
      }

      afterResponse(() => notifyOrderCreated({
        organizationId: organization.id,
        branchId: typeof fullOrder.branch_id === 'string' ? fullOrder.branch_id : branchScope.branchId,
        orderId: createdOrderId,
        online: false,
        actorUserId: user.id,
        orderNumber: fullOrder.order_number,
        customerName: fullOrder.customer_name,
        total: Number(fullOrder.total || 0),
      }))
    }

    return NextResponse.json(
      { success: true, data: normalizeOrder(fullOrder), idempotent: replayed },
      { status: replayed ? 200 : 201 }
    )
  } catch (error) {
    if (error instanceof PaymentControlError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    logger.error('Orders API POST error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo crear el pedido.' }, { status: 500 })
  }
})

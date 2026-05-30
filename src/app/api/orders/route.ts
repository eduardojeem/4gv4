import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import { generateOrderNumber, normalizeOrder, sanitizeOrderSearch } from '@/lib/orders/helpers'
import type { FulfillmentType, PaymentMethod } from '@/lib/orders/types'

const STAT_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const

const orderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(1000),
  unitPrice: z.number().min(0).optional(),
})

const createOrderSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  customer: z.object({
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().email().optional().or(z.literal('')).nullable(),
    phone: z.string().trim().max(50).optional().nullable(),
    address: z.string().trim().max(500).optional().nullable(),
  }).optional(),
  items: z.array(orderItemSchema).min(1),
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER', 'DIGITAL_WALLET']).default('CASH'),
  fulfillmentType: z.enum(['PICKUP', 'DELIVERY']).default('PICKUP'),
  shippingCost: z.number().min(0).default(0),
  discountAmount: z.number().min(0).default(0),
  notes: z.string().trim().max(2000).optional().nullable(),
})

export const GET = withTenantAuth({ permission: 'ecommerce.orders.manage' }, async (request, { organization }) => {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)))
    const status = searchParams.get('status')
    const paymentStatus = searchParams.get('payment_status')
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

    if (status && status !== 'ALL') {
      query = query.eq('status', status)
    }
    if (paymentStatus && paymentStatus !== 'ALL') {
      query = query.eq('payment_status', paymentStatus)
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

    // Stats: use parallel HEAD-only COUNT queries instead of fetching all rows
    let stats: Record<string, number> | null = null
    if (includeStats) {
      const statsResults = await Promise.all(
        STAT_STATUSES.map((s) =>
          supabase
            .from('customer_orders')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organization.id)
            .eq('status', s)
        )
      )
      stats = Object.fromEntries(STAT_STATUSES.map((s, i) => [s, statsResults[i].count ?? 0]))
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
    let customerId = input.customerId || null
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
    } else if (customerSnapshot) {
      const now = new Date().toISOString()
      const { data: createdCustomer, error } = await supabase
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

      if (error) throw error
      customerId = createdCustomer.id
    }

    if (!customerSnapshot) {
      return NextResponse.json({ success: false, error: 'El pedido necesita un cliente.' }, { status: 400 })
    }

    const productIds = input.items.map((item) => item.productId)
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, sku, sale_price, offer_price, stock_quantity')
      .eq('organization_id', organization.id)
      .in('id', productIds)

    if (productsError) throw productsError

    const productMap = new Map((products ?? []).map((product) => [String(product.id), product]))
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
      const unitPrice = item.unitPrice ?? Number(product.offer_price || product.sale_price || 0)
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
    const total = Math.max(0, subtotal + input.shippingCost - input.discountAmount)
    const now = new Date().toISOString()

    const { data: order, error: orderError } = await supabase
      .from('customer_orders')
      .insert({
        organization_id: organization.id,
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
        created_by: user.id,
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

    await supabase.from('customer_order_status_history').insert({
      organization_id: organization.id,
      order_id: order.id,
      to_status: 'PENDING',
      note: 'Pedido creado desde el dashboard.',
      changed_by: user.id,
    })

    const { data: fullOrder } = await supabase
      .from('customer_orders')
      .select('*, order_items:customer_order_items(*)')
      .eq('id', order.id)
      .eq('organization_id', organization.id)
      .single()

    return NextResponse.json({ success: true, data: normalizeOrder(fullOrder ?? order) }, { status: 201 })
  } catch (error) {
    logger.error('Orders API POST error', { error })
    return NextResponse.json({ success: false, error: 'No se pudo crear el pedido.' }, { status: 500 })
  }
})

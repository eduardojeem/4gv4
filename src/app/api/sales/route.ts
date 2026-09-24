import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { isLoyaltyModuleMissing } from '@/lib/loyalty/module-status'
import { tryAutoRaffleEntryForSale } from '@/lib/raffles/auto-entry'
import { saleSchema, saleUpdateSchema } from '@/lib/validation/schemas'
import { SALE_STATUS } from '@/lib/sales-status'
import { createAdminSupabase } from '@/lib/supabase/admin'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Lo que puede salir mal al anular, dicho en castellano. */
const VOID_ERRORS: Array<[string, string, number]> = [
  ['SALE_NOT_IN_ORGANIZATION', 'No encontramos esa venta en tu negocio.', 404],
  ['SALE_CREDIT_ALREADY_PAID', 'El crédito de esta venta ya tiene cuotas cobradas. Resolvé primero la devolución del dinero con el cliente.', 409],
  ['VOID_REQUIRES_OPEN_REGISTER', 'Abrí la caja antes de anular: hay efectivo que devolver y tiene que quedar registrado.', 409],
]

// GET /api/sales - Get sales with filters
export const GET = withTenantAuth({ permission: 'pos.sales.read', module: 'pos' }, async (request, { organization }) => {
  try {
    const { searchParams } = new URL(request.url)
    
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const customerId = searchParams.get('customer_id')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '50')
    
    const supabase = await createClient()
    
    // Build query with relations
    let queryBuilder = supabase
      .from('sales')
      .select(`
        *,
        customer:customers!customer_id(id, first_name, last_name, phone),
        sale_items(
          *,
          product:products(id, name, sku)
        )
      `, { count: 'exact' })
      .eq('organization_id', organization.id)
    
    // Apply filters
    if (startDate) {
      queryBuilder = queryBuilder.gte('created_at', startDate)
    }
    
    if (endDate) {
      queryBuilder = queryBuilder.lte('created_at', endDate)
    }
    
    if (customerId) {
      queryBuilder = queryBuilder.eq('customer_id', customerId)
    }
    
    if (status) {
      queryBuilder = queryBuilder.eq('status', status)
    }
    
    // Apply pagination
    const from = (page - 1) * perPage
    const to = from + perPage - 1
    
    const { data: sales, error, count } = await queryBuilder
      .range(from, to)
      .order('created_at', { ascending: false })
    
    if (error) {
      logger.error('Failed to fetch sales', { error: error.message, code: error.code })
      throw error
    }
    
    return NextResponse.json({
      success: true,
      data: {
        sales: sales || [],
        total: count || 0,
        page,
        per_page: perPage
      }
    })
  } catch (error) {
    logger.error('Sales API error', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sales' },
      { status: 500 }
    )
  }
})

// POST /api/sales - Create new sale with items
export const POST = withTenantAuth({ permission: 'pos.sales.create', module: 'pos' }, async (request, { user, organization }) => {
  try {
    const body = await request.json()
    const supabase = await createClient()
    
    // Validate input with Zod
    const validationResult = saleSchema.safeParse(body)
    
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))
      
      return NextResponse.json({
        success: false,
        error: 'Error de validación',
        details: errors
      }, { status: 400 })
    }
    
    const validated = validationResult.data

    // Auto-detect customer_id for logged-in customers if not provided
    let finalCustomerId = validated.customer_id

    if (!finalCustomerId) {
      const { data: customerData } = await supabase
        .from('customers')
        .select('id')
        .eq('profile_id', user.id)
        .single()
      
      if (customerData) {
        finalCustomerId = customerData.id
      }
    }
    
    // Start transaction-like operation
    // 1. Insert sale
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        user_id: user.id,
        created_by: user.id,
        organization_id: organization.id,
        customer_id: finalCustomerId || null,
        total: validated.total_amount,
        tax: validated.tax_amount || 0,
        discount: validated.discount_amount || 0,
        payment_method: validated.payment_method,
        status: validated.status || SALE_STATUS.COMPLETED
      })
      .select()
      .single()
    
    if (saleError) {
      logger.error('Failed to create sale', { error: saleError.message, userId: user.id })
      throw saleError
    }
    
    // 2. Insert sale items
    const saleItems = validated.items.map((item) => ({
      sale_id: sale.id,
      organization_id: organization.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.total || (item.quantity * item.unit_price)
    }))
    
    const { error: itemsError } = await supabase
      .from('sale_items')
      .insert(saleItems)
    
    if (itemsError) {
      logger.error('Failed to create sale items, rolling back sale', {
        error: itemsError.message,
        saleId: sale.id
      })
      
      // Rollback: delete the sale
      await supabase
        .from('sales')
        .delete()
        .eq('id', sale.id)
        .eq('organization_id', organization.id)
      
      return NextResponse.json(
        { success: false, error: 'Failed to create sale items' },
        { status: 500 }
      )
    }
    
    // 3. Update product stock (decrease)
    for (const item of validated.items) {
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', item.product_id)
        .eq('organization_id', organization.id)
        .single()
      
      if (!productError && product) {
        const newStock = (product.stock_quantity || 0) - item.quantity
        
        await supabase
          .from('products')
          .update({ stock_quantity: Math.max(0, newStock) })
          .eq('id', item.product_id)
          .eq('organization_id', organization.id)
      }
    }
    
    // 4. Acreditar puntos de fidelidad.
    //
    // Va despues del stock y fuera del camino critico a proposito: si algo
    // falla acá, la venta ya está hecha y no se revierte por los puntos. La
    // función es idempotente por venta, así que un reintento posterior no
    // acredita dos veces. Sin cliente asignado no hay a quién acreditarle.
    if (finalCustomerId) {
      const { error: loyaltyError } = await supabase.rpc('award_loyalty_points_for_sale', {
        p_organization_id: organization.id,
        p_customer_id: finalCustomerId,
        p_amount: validated.total_amount,
        p_sale_id: sale.id,
        p_idempotency_key: `sale:${sale.id}`,
      })

      if (loyaltyError && !isLoyaltyModuleMissing(loyaltyError)) {
        // Se registra pero no se le devuelve error al cajero: la venta salió.
        logger.warn('No se pudieron acreditar los puntos de la venta', {
          saleId: sale.id,
          error: loyaltyError.message,
        })
      }

      // 5. Entrada automática a sorteos abiertos vigentes si el cliente califica
      let autoRaffleTickets = null
      try {
        autoRaffleTickets = await tryAutoRaffleEntryForSale(
          supabase,
          organization.id,
          finalCustomerId,
          validated.total_amount
        )
      } catch (raffleErr) {
        logger.warn('No se pudieron asignar tickets automáticos de sorteo', { error: raffleErr })
      }

      logger.info('Sale created successfully', {
        saleId: sale.id,
        itemCount: saleItems.length,
        total: validated.total_amount,
        userId: user.id
      })
      
      // Fetch complete sale with relations for response
      const { data: completeSale } = await supabase
        .from('sales')
        .select(`
          *,
          customer:customers!customer_id(id, first_name, last_name),
          sale_items(*, product:products(id, name, sku))
        `)
        .eq('id', sale.id)
        .eq('organization_id', organization.id)
        .single()
      
      return NextResponse.json({
        success: true,
        data: completeSale || sale,
        raffleTickets: autoRaffleTickets
      }, { status: 201 })
    }

    logger.info('Sale created successfully', {
      saleId: sale.id,
      itemCount: saleItems.length,
      total: validated.total_amount,
      userId: user.id
    })
    
    // Fetch complete sale with relations for response
    const { data: completeSale } = await supabase
      .from('sales')
      .select(`
        *,
        customer:customers!customer_id(id, first_name, last_name),
        sale_items(*, product:products(id, name, sku))
      `)
      .eq('id', sale.id)
      .eq('organization_id', organization.id)
      .single()
    
    return NextResponse.json({
      success: true,
      data: completeSale || sale
    }, { status: 201 })
  } catch (error) {
    logger.error('Sale creation error', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to create sale' },
      { status: 500 }
    )
  }
})

// PUT /api/sales - Update sale status
export const PUT = withTenantAuth({ permission: 'pos.cash.manage', module: 'pos' }, async (request, { user, organization }) => {
  try {
    const body = await request.json()
    const supabase = await createClient()
    
    if (!body.id) {
      return NextResponse.json(
        { success: false, error: 'Sale ID is required' },
        { status: 400 }
      )
    }
    
    // Validate input with Zod
    const validationResult = saleUpdateSchema.safeParse(body)
    
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))
      
      return NextResponse.json({
        success: false,
        error: 'Error de validación',
        details: errors
      }, { status: 400 })
    }
    
    const validated = validationResult.data
    
    // Only allow updating status for now (to prevent complex scenarios)
    const updates: any = {}
    if (validated.status) updates.status = validated.status
    
    const { data: sale, error } = await supabase
      .from('sales')
      .update(updates)
      .eq('id', validated.id)
      .eq('organization_id', organization.id)
      .select()
      .single()
    
    if (error) {
      logger.error('Failed to update sale', { error: error.message, saleId: validated.id })
      throw error
    }
    
    logger.info('Sale updated', { saleId: sale.id, userId: user.id })
    
    return NextResponse.json({
      success: true,
      data: sale
    })
  } catch (error) {
    logger.error('Sale update error', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to update sale' },
      { status: 500 }
    )
  }
})

/**
 * DELETE /api/sales — anula la venta; no la borra.
 *
 * Antes borraba la fila y sus items, y nada mas: el stock descontado no volvia,
 * el credito y sus cuotas seguian vivos —el cliente seguia debiendo una venta
 * inexistente— y la plata seguia contada en el cierre de caja.
 *
 * Ahora todo el trabajo lo hace `void_pos_sale` en una sola transaccion:
 * devuelve el stock, cancela las cuotas impagas, saca el efectivo con un
 * movimiento inverso y deja la venta marcada como anulada, con el motivo.
 */
export const DELETE = withTenantAuth({ permission: 'pos.cash.manage', module: 'pos' }, async (request, { user, organization }) => {
  const { searchParams } = new URL(request.url)
  const saleId = searchParams.get('id')
  const reason = searchParams.get('reason')

  if (!saleId || !UUID_PATTERN.test(saleId)) {
    return NextResponse.json({ success: false, error: 'Indicá qué venta anular.' }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const { data, error } = await admin.rpc('void_pos_sale', {
    p_sale_id: saleId,
    p_organization_id: organization.id,
    p_actor_id: user.id,
    p_reason: reason?.slice(0, 300) ?? null,
  })

  if (error) {
    const texto = `${error.message ?? ''} ${error.details ?? ''}`
    for (const [codigo, mensaje, estado] of VOID_ERRORS) {
      if (texto.includes(codigo)) {
        return NextResponse.json({ success: false, error: mensaje }, { status: estado })
      }
    }
    if (texto.includes('void_pos_sale') || error.code === '42883') {
      return NextResponse.json({
        success: false,
        error: 'Falta aplicar la migración de anulación de ventas. La venta no fue modificada.',
      }, { status: 503 })
    }
    logger.error('Sale void failed', { error: error.message, saleId })
    return NextResponse.json({ success: false, error: 'No se pudo anular la venta.' }, { status: 500 })
  }

  const resultado = (data ?? {}) as Record<string, unknown>
  logger.info('Sale voided', { saleId, userId: user.id, resultado })

  return NextResponse.json({
    success: true,
    data: resultado,
    message: resultado.already_voided === true
      ? 'Esta venta ya estaba anulada.'
      : 'Venta anulada: se devolvió el stock y se cancelaron las cuotas pendientes.',
  })
})

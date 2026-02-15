import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/withAuth'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { logger } from '@/lib/logger'
import { saleSchema, saleUpdateSchema } from '@/lib/validation/schemas'

// GET /api/sales - Get sales with filters
export const GET = withAuth(async (request, { user }) => {
  try {
    const { searchParams } = new URL(request.url)
    
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const customerId = searchParams.get('customer_id')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '50')
    
    const supabase = createRouteHandlerClient({ cookies })
    
    // Build query with relations
    let queryBuilder = supabase
      .from('sales')
      .select(`
        *,
        customer:customers(id, first_name, last_name, phone),
        sale_items(
          *,
          product:products(id, name, sku)
        )
      `, { count: 'exact' })
    
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
export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json()
    const supabase = createRouteHandlerClient({ cookies })
    
    // Validate input with Zod
    const validationResult = saleSchema.safeParse(body)
    
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))
      
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
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
        customer_id: finalCustomerId || null,
        total: validated.total_amount,
        tax: validated.tax_amount || 0,
        discount: validated.discount_amount || 0,
        payment_method: validated.payment_method,
        status: validated.status || 'completada'
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
      await supabase.from('sales').delete().eq('id', sale.id)
      
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
        .single()
      
      if (!productError && product) {
        const newStock = (product.stock_quantity || 0) - item.quantity
        
        await supabase
          .from('products')
          .update({ stock_quantity: Math.max(0, newStock) })
          .eq('id', item.product_id)
      }
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
        customer:customers(id, first_name, last_name),
        sale_items(*, product:products(id, name, sku))
      `)
      .eq('id', sale.id)
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
export const PUT = withAuth(async (request, { user }) => {
  try {
    const body = await request.json()
    const supabase = createRouteHandlerClient({ cookies })
    
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
        error: 'Validation failed',
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

// DELETE /api/sales - Delete sale (admin only)
export const DELETE = withAuth(async (request, { user }) => {
  try {
    const { searchParams } = new URL(request.url)
    const saleId = searchParams.get('id')
    
    if (!saleId) {
      return NextResponse.json(
        { success: false, error: 'Sale ID is required' },
        { status: 400 }
      )
    }
    
    const supabase = createRouteHandlerClient({ cookies })
    
    // Check if user is admin
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Only admins can delete sales' },
        { status: 403 }
      )
    }
    
    // Delete sale items first (cascade might handle this, but being explicit)
    await supabase
      .from('sale_items')
      .delete()
      .eq('sale_id', saleId)
    
    // Delete sale
    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('id', saleId)
    
    if (error) {
      logger.error('Failed to delete sale', { error: error.message, saleId })
      throw error
    }
    
    logger.info('Sale deleted', { saleId, userId: user.id })
    
    return NextResponse.json({
      success: true,
      message: 'Sale deleted successfully'
    })
  } catch (error) {
    logger.error('Sale deletion error', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to delete sale' },
      { status: 500 }
    )
  }
})
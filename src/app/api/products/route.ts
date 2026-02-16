import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/withAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { productSchema, productUpdateSchema } from '@/lib/validation/schemas'

// GET /api/products - Get products with variants
export const GET = withAuth(async (request, { user }) => {
  try {
    const { searchParams } = new URL(request.url)
    
    const query = searchParams.get('query')
    const categoryId = searchParams.get('category_id')
    const brand = searchParams.get('brand')
    const inStock = searchParams.get('in_stock') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '50')
    
    const supabase = await createClient()
    
    // Build query
    let queryBuilder = supabase
      .from('products')
      .select('*, category:categories(id, name)', { count: 'exact' })
    
    // Apply filters
    if (query) {
      queryBuilder = queryBuilder.or(
        `name.ilike.%${query}%,sku.ilike.%${query}%,description.ilike.%${query}%`
      )
    }
    
    if (categoryId) {
      queryBuilder = queryBuilder.eq('category_id', categoryId)
    }
    
    if (brand) {
      queryBuilder = queryBuilder.eq('brand', brand)
    }
    
    if (inStock) {
      queryBuilder = queryBuilder.gt('stock_quantity', 0)
    }
    
    // Apply pagination
    const from = (page - 1) * perPage
    const to = from + perPage - 1
    
    const { data: products, error, count } = await queryBuilder
      .range(from, to)
      .order('name', { ascending: true })
    
    if (error) {
      logger.error('Failed to fetch products', { error: error.message, code: error.code })
      throw error
    }
    
    return NextResponse.json({
      success: true,
      data: {
        products: products || [],
        total: count || 0,
        page,
        per_page: perPage
      }
    })
  } catch (error) {
    logger.error('Products API error', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
})

// POST /api/products - Create new product
export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json()
    const supabase = await createClient()
    
    // Validate input with Zod
    const validationResult = productSchema.safeParse(body)
    
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
    
    const { data: product, error } = await supabase
      .from('products')
      .insert({
        name: validated.name,
        sku: validated.sku,
        description: validated.description,
        category_id: validated.category_id,
        supplier_id: validated.supplier_id,
        brand: validated.brand,
        stock_quantity: validated.stock_quantity,
        min_stock: validated.min_stock,
        purchase_price: validated.purchase_price,
        sale_price: validated.sale_price,
        is_active: validated.is_active,
        barcode: validated.barcode,
        unit_measure: validated.unit_measure
      })
      .select()
      .single()
    
    if (error) {
      logger.error('Failed to create product', { error: error.message, code: error.code })
      
      // Handle unique constraint violations
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'Product with this SKU already exists' },
          { status: 409 }
        )
      }
      
      throw error
    }
    
    logger.info('Product created', { productId: product.id, userId: user.id })
    
    return NextResponse.json({
      success: true,
      data: product
    }, { status: 201 })
  } catch (error) {
    logger.error('Product creation error', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to create product' },
      { status: 500 }
    )
  }
})

// PUT /api/products - Update product
export const PUT = withAuth(async (request, { user }) => {
  try {
    const body = await request.json()
    const supabase = await createClient()
    
    if (!body.id) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      )
    }
    
    // Validate input with Zod
    const validationResult = productUpdateSchema.safeParse(body)
    
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
    
    const { data: product, error } = await supabase
      .from('products')
      .update({
        name: validated.name,
        description: validated.description,
        category_id: validated.category_id,
        supplier_id: validated.supplier_id,
        brand: validated.brand,
        stock_quantity: validated.stock_quantity,
        min_stock: validated.min_stock,
        purchase_price: validated.purchase_price,
        sale_price: validated.sale_price,
        is_active: validated.is_active,
        barcode: validated.barcode,
        unit_measure: validated.unit_measure
      })
      .eq('id', validated.id)
      .select()
      .single()
    
    if (error) {
      logger.error('Failed to update product', { error: error.message, productId: validated.id })
      throw error
    }
    
    logger.info('Product updated', { productId: product.id, userId: user.id })
    
    return NextResponse.json({
      success: true,
      data: product
    })
  } catch (error) {
    logger.error('Product update error', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to update product' },
      { status: 500 }
    )
  }
})

// DELETE /api/products - Delete products (single or bulk)
export const DELETE = withAuth(async (request, { user }) => {
  try {
    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids')
    
    if (!idsParam) {
      return NextResponse.json(
        { success: false, error: 'Product IDs are required' },
        { status: 400 }
      )
    }
    
    const ids = idsParam.split(',')
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('products')
      .delete()
      .in('id', ids)
    
    if (error) {
      logger.error('Failed to delete products', { error: error.message, ids })
      throw error
    }
    
    logger.info('Products deleted', { count: ids.length, userId: user.id })
    
    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${ids.length} product(s)`
    })
  } catch (error) {
    logger.error('Product deletion error', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to delete products' },
      { status: 500 }
    )
  }
})
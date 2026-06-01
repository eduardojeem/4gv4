import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { productSchema, productUpdateSchema } from '@/lib/validation/schemas'
import type { AppRole } from '@/lib/auth/role-utils'
import { getRequestedBranchId, getDefaultBranch, resolveBranchScopeForUser } from '@/lib/branches/server'
import { applyBranchInventoryToProducts, loadBranchInventoryStockMap, upsertBranchInventoryStock } from '@/lib/branches/inventory'
import { canCreateResource } from '@/lib/saas/subscription-service'

// GET /api/products - Get products with variants
export const GET = withTenantAuth({ permission: 'inventory.products.read', module: 'inventory' }, async (request, { user, organization }) => {
  try {
    const { searchParams } = new URL(request.url)
    
    const query = searchParams.get('query')
    const categoryId = searchParams.get('category_id')
    const brand = searchParams.get('brand')
    const inStock = searchParams.get('in_stock') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '50')
    const requestedBranchId = getRequestedBranchId(request)
    
    const supabase = await createClient()
    const branchScope = await resolveBranchScopeForUser({
      userId: user.id,
      role: user.role as AppRole | undefined,
      requestedBranchId,
      organizationId: organization.id,
      strict: Boolean(requestedBranchId),
    })
    
    // Build query
    let queryBuilder = supabase
      .from('products')
      .select('*, category:categories(id, name)', { count: 'exact' })
      .eq('organization_id', organization.id)
    
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
      queryBuilder = queryBuilder.ilike('brand', brand)
    }
    
    if (inStock && !branchScope.branchId) {
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
    
    const baseProducts = (products || []) as Array<Record<string, unknown> & { id: string; stock_quantity?: number | null }>
    const branchInventoryClient = supabase as unknown as Parameters<typeof loadBranchInventoryStockMap>[0]
    const { stockMap, branchScoped } = await loadBranchInventoryStockMap(
      branchInventoryClient,
      branchScope.branchId,
      baseProducts.map((product) => product.id)
    )
    const branchAwareProducts = applyBranchInventoryToProducts(baseProducts, stockMap, branchScoped)
    const filteredProducts = inStock
      ? branchAwareProducts.filter((product) => Number(product.stock_quantity || 0) > 0)
      : branchAwareProducts

    return NextResponse.json({
      success: true,
      data: {
        products: filteredProducts,
        total: branchScoped && inStock ? filteredProducts.length : (count || 0),
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
export const POST = withTenantAuth({ permission: 'inventory.products.create', module: 'inventory' }, async (request, { user, organization }) => {
  try {
    const body = await request.json()
    const supabase = await createClient()
    const requestedBranchId = getRequestedBranchId(request, typeof body?.branch_id === 'string' ? body.branch_id : undefined)
    const branchScope = await resolveBranchScopeForUser({
      userId: user.id,
      role: user.role as AppRole | undefined,
      requestedBranchId,
      organizationId: organization.id,
      strict: Boolean(requestedBranchId),
    })
    const defaultBranch = await getDefaultBranch(organization.id)
    
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
    const planGate = await canCreateResource(organization.id, 'products')

    if (!planGate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Tu plan ${planGate.plan.name} permite hasta ${planGate.limit} productos. Actualiza el plan para crear mas.`,
          code: 'PLAN_LIMIT_REACHED',
          resource: 'products',
          current: planGate.current,
          limit: planGate.limit,
        },
        { status: 402 }
      )
    }

    const requestedStock = Number(validated.stock_quantity || 0)
    const branchScopedCreate = Boolean(branchScope.branchId)
    const shouldZeroGlobalStock = Boolean(
      branchScope.branchId &&
      defaultBranch?.id &&
      branchScope.branchId !== defaultBranch.id
    )
    
    const { data: product, error } = await supabase
      .from('products')
      .insert({
        name: validated.name,
        organization_id: organization.id,
        sku: validated.sku,
        description: validated.description,
        category_id: validated.category_id,
        supplier_id: validated.supplier_id,
        brand: validated.brand,
        stock_quantity: shouldZeroGlobalStock ? 0 : requestedStock,
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

    if (branchScopedCreate && branchScope.branchId) {
      try {
        const branchInventoryClient = supabase as unknown as Parameters<typeof upsertBranchInventoryStock>[0]['supabase']

        if (defaultBranch?.id && defaultBranch.id !== branchScope.branchId) {
          await upsertBranchInventoryStock({
            supabase: branchInventoryClient,
            branchId: defaultBranch.id,
            productId: product.id,
            stockQuantity: 0,
          })
        }

        await upsertBranchInventoryStock({
          supabase: branchInventoryClient,
          branchId: branchScope.branchId,
          productId: product.id,
          stockQuantity: requestedStock,
        })
      } catch (branchError) {
        logger.error('Failed to sync branch inventory after product creation', {
          error: branchError instanceof Error ? branchError.message : branchError,
          productId: product.id,
          branchId: branchScope.branchId,
        })

        await supabase
          .from('products')
          .delete()
          .eq('id', product.id)
          .eq('organization_id', organization.id)

        return NextResponse.json(
          { success: false, error: 'No se pudo sincronizar el stock inicial de la sucursal.' },
          { status: 500 }
        )
      }
    }
    
    logger.info('Product created', { productId: product.id, userId: user.id })

    const responseProduct = branchScopedCreate && branchScope.branchId
      ? applyBranchInventoryToProducts(
          [product as Record<string, unknown> & { id: string; stock_quantity?: number | null }],
          new Map([[product.id, requestedStock]]),
          true
        )[0]
      : product
    
    return NextResponse.json({
      success: true,
      data: responseProduct
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
export const PUT = withTenantAuth({ permission: 'inventory.products.update', module: 'inventory' }, async (request, { user, organization }) => {
  try {
    const body = await request.json()
    const supabase = await createClient()
    const requestedBranchId = getRequestedBranchId(request, typeof body?.branch_id === 'string' ? body.branch_id : undefined)
    const branchScope = await resolveBranchScopeForUser({
      userId: user.id,
      role: user.role as AppRole | undefined,
      requestedBranchId,
      organizationId: organization.id,
      strict: Boolean(requestedBranchId),
    })
    
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
    const desiredStockQuantity = validated.stock_quantity
    const updatePayload: Record<string, unknown> = {
      name: validated.name,
      description: validated.description,
      category_id: validated.category_id,
      supplier_id: validated.supplier_id,
      brand: validated.brand,
      min_stock: validated.min_stock,
      purchase_price: validated.purchase_price,
      sale_price: validated.sale_price,
      is_active: validated.is_active,
      barcode: validated.barcode,
      unit_measure: validated.unit_measure
    }

    if (!branchScope.branchId && desiredStockQuantity !== undefined) {
      updatePayload.stock_quantity = desiredStockQuantity
    }

    const normalizedPayload = Object.fromEntries(
      Object.entries(updatePayload).filter(([, value]) => value !== undefined)
    )

    let product = null as Record<string, unknown> | null
    if (Object.keys(normalizedPayload).length > 0) {
      const { data, error } = await supabase
        .from('products')
        .update(normalizedPayload)
        .eq('id', validated.id)
        .eq('organization_id', organization.id)
        .select()
        .single()

      if (error) {
        logger.error('Failed to update product', { error: error.message, productId: validated.id })
        throw error
      }

      product = data as Record<string, unknown>
    }

    if (branchScope.branchId && desiredStockQuantity !== undefined) {
      await upsertBranchInventoryStock({
        supabase: supabase as unknown as Parameters<typeof upsertBranchInventoryStock>[0]['supabase'],
        branchId: branchScope.branchId,
        productId: validated.id,
        stockQuantity: Number(desiredStockQuantity),
      })
    }

    const { data: refreshedProduct, error: refreshedProductError } = await supabase
      .from('products')
      .select('*')
      .eq('id', validated.id)
      .eq('organization_id', organization.id)
      .single()

    if (refreshedProductError) {
      logger.error('Failed to reload product after update', {
        error: refreshedProductError.message,
        productId: validated.id,
      })
      throw refreshedProductError
    }

    product = refreshedProduct as Record<string, unknown>

    logger.info('Product updated', { productId: product.id, userId: user.id })

    const responseProduct = branchScope.branchId && desiredStockQuantity !== undefined
      ? applyBranchInventoryToProducts(
          [product as Record<string, unknown> & { id: string; stock_quantity?: number | null }],
          new Map([[String(product.id), Number(desiredStockQuantity)]]),
          true
        )[0]
      : product
    
    return NextResponse.json({
      success: true,
      data: responseProduct
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
export const DELETE = withTenantAuth({ permission: 'inventory.products.delete', module: 'inventory' }, async (request, { user, organization }) => {
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
      .eq('organization_id', organization.id)
    
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

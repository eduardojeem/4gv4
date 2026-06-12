import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { productUpdateSchema } from '@/lib/validation/schemas'
import { logger } from '@/lib/logger'
import type { AppRole } from '@/lib/auth/role-utils'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'
import {
  applyBranchInventoryToProducts,
  loadBranchInventoryStockMap,
  upsertBranchInventoryStock,
  type BranchInventoryClient,
} from '@/lib/branches/inventory'

type ProductRouteContext = { params: Promise<{ id: string }> }

// GET /api/products/[id] - Obtener producto especifico (usuario autenticado)
export const GET = withTenantAuth({ permission: 'inventory.products.read', module: 'inventory' }, async (
  request: NextRequest,
  { user, organization },
  routeContext?: unknown
) => {
  try {
    const { params } = routeContext as ProductRouteContext
    const { id } = await params
    const supabase = await createClient()
    const requestedBranchId = getRequestedBranchId(request)
    const branchScope = await resolveBranchScopeForUser({
      userId: user.id,
      role: user.role as AppRole | undefined,
      requestedBranchId,
      organizationId: organization.id,
      strict: Boolean(requestedBranchId),
    })

    const { data: product, error } = await supabase
      .from('products')
      .select('*, category:categories(id, name)')
      .eq('id', id)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (error) {
      logger.error('Failed to fetch product by id', { productId: id, error: error.message })
      throw error
    }

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    const branchInventoryClient = supabase as unknown as BranchInventoryClient
    const { stockMap, branchScoped } = await loadBranchInventoryStockMap(
      branchInventoryClient,
      branchScope.branchId,
      [product.id]
    )
    const responseProduct = applyBranchInventoryToProducts(
      [product as Record<string, unknown> & { id: string; stock_quantity?: number | null }],
      stockMap,
      branchScoped
    )[0]

    return NextResponse.json({
      success: true,
      data: responseProduct,
    })
  } catch (error) {
    logger.error('Product detail API error', { error })
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
})

// PUT /api/products/[id] - Actualizar producto especifico (staff only)
export const PUT = withTenantAuth({ permission: 'inventory.products.update', module: 'inventory' }, async (
  request: NextRequest,
  { user, organization },
  routeContext?: unknown
) => {
  try {
    const { params } = routeContext as ProductRouteContext
    const { id } = await params
    const body = await request.json()
    const supabase = await createClient()
    const requestedBranchId = getRequestedBranchId(request, typeof body?.branch_id === 'string' ? body.branch_id : undefined)

    let branchScope: Awaited<ReturnType<typeof resolveBranchScopeForUser>>
    try {
      branchScope = await resolveBranchScopeForUser({
        userId: user.id,
        role: user.role as AppRole | undefined,
        requestedBranchId,
        organizationId: organization.id,
        strict: Boolean(requestedBranchId),
      })
    } catch (branchErr) {
      console.error('[PRODUCTS PUT] Branch scope error:', branchErr)
      return NextResponse.json(
        { success: false, error: branchErr instanceof Error ? branchErr.message : 'Sucursal no autorizada' },
        { status: 403 }
      )
    }

    const validationResult = productUpdateSchema.safeParse({
      ...body,
      id,
    })

    if (!validationResult.success) {
      const details = validationResult.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }))

      return NextResponse.json(
        { success: false, error: 'Validation failed', details },
        { status: 400 }
      )
    }

    const validated = validationResult.data
    const { data: existingProduct, error: existingProductError } = await supabase
      .from('products')
      .select('id')
      .eq('id', id)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (existingProductError) {
      logger.error('Failed to verify product tenant before update', {
        productId: id,
        organizationId: organization.id,
        error: existingProductError.message,
      })
      throw existingProductError
    }

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    const updatePayload: Record<string, unknown> = {}
    // Only consider stock_quantity if the client explicitly sent it
    const desiredStockQuantity = 'stock_quantity' in body && body.stock_quantity !== undefined
      ? validated.stock_quantity
      : undefined

    const allowedKeys: Array<keyof typeof validated> = [
      'name',
      'description',
      'category_id',
      'supplier_id',
      'brand',
      'brand_id',
      'min_stock',
      'max_stock',
      'purchase_price',
      'sale_price',
      'wholesale_price',
      'offer_price',
      'has_offer',
      'is_active',
      'barcode',
      'unit_measure',
      'visibility',
      'warranty_months',
      'warranty_info',
      'return_window_days',
      'exchange_window_days',
      'return_policy',
      'exchange_policy',
      'images',
      'image_url',
    ]

    for (const key of allowedKeys) {
      // Only include fields that the client actually sent in the body
      if (!(key in body)) continue
      const value = validated[key]
      if (value !== undefined) {
        updatePayload[key] = value
      }
    }

    if (Object.keys(updatePayload).length === 0 && desiredStockQuantity === undefined) {
      return NextResponse.json(
        { success: false, error: 'No hay campos para actualizar' },
        { status: 400 }
      )
    }

    if (!branchScope.branchId && desiredStockQuantity !== undefined) {
      updatePayload.stock_quantity = desiredStockQuantity
    }

    let updatedProduct = null as Record<string, unknown> | null
    if (Object.keys(updatePayload).length > 0) {
      const { data, error } = await supabase
        .from('products')
        .update(updatePayload)
        .eq('id', id)
        .eq('organization_id', organization.id)
        .select('*, category:categories(id, name)')
        .maybeSingle()

      if (error) {
        console.error('[PRODUCTS PUT] Supabase update error:', error.message, error.code, error.details)
        logger.error('Failed to update product by id', { productId: id, error: error.message })
        throw error
      }

      updatedProduct = data as Record<string, unknown> | null
    }

    if (branchScope.branchId && desiredStockQuantity !== undefined) {
      await upsertBranchInventoryStock({
        supabase: createAdminSupabase() as unknown as BranchInventoryClient,
        branchId: branchScope.branchId,
        productId: id,
        stockQuantity: Number(desiredStockQuantity),
      })
    }

    const { data: refreshedProduct, error: refreshedProductError } = await supabase
      .from('products')
      .select('*, category:categories(id, name)')
      .eq('id', id)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (refreshedProductError) {
      logger.error('Failed to reload product after update by id', { productId: id, error: refreshedProductError.message })
      throw refreshedProductError
    }

    if (!refreshedProduct) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    updatedProduct = refreshedProduct as Record<string, unknown>

    // Only apply branch inventory overlay when the request explicitly changed stock
    let responseProduct = updatedProduct
    if (branchScope.branchId && desiredStockQuantity !== undefined) {
      responseProduct = applyBranchInventoryToProducts(
        [updatedProduct as Record<string, unknown> & { id: string; stock_quantity?: number | null }],
        new Map([[id, Number(desiredStockQuantity)]]),
        true
      )[0] ?? updatedProduct
    }

    return NextResponse.json({
      success: true,
      data: responseProduct,
    })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('[PRODUCTS PUT] Update failed:', errMsg, error)
    logger.error('Product update by id API error', { error })
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor', _debug: errMsg },
      { status: 500 }
    )
  }
})

// DELETE /api/products/[id] - Eliminar producto especifico (staff only)
export const DELETE = withTenantAuth({ permission: 'inventory.products.delete', module: 'inventory' }, async (
  _request: NextRequest,
  { organization },
  routeContext?: unknown
) => {
  try {
    const { params } = routeContext as ProductRouteContext
    const { id } = await params
    const supabase = await createClient()

    const { data: existing, error: existingError } = await supabase
      .from('products')
      .select('id,name,sku')
      .eq('id', id)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (existingError) {
      logger.error('Failed to verify product before delete', { productId: id, error: existingError.message })
      throw existingError
    }

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('organization_id', organization.id)

    if (error) {
      logger.error('Failed to delete product by id', { productId: id, error: error.message })
      throw error
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Producto eliminado exitosamente',
        deleted_product: existing,
      },
    })
  } catch (error) {
    logger.error('Product delete by id API error', { error })
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
})

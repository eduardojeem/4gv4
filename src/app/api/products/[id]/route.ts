import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { productUpdateSchema } from '@/lib/validation/schemas'
import { logger } from '@/lib/logger'
import {
  type AppRole,
  stripProductCost,
  canViewProductCost,
  PRODUCT_COST_PERMISSION,
} from '@/lib/auth/role-utils'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'
import {
  applyBranchInventoryToProducts,
  loadBranchInventoryStockMap,
  upsertBranchInventoryStock,
  type BranchInventoryClient,
} from '@/lib/branches/inventory'

type ProductRouteContext = { params: Promise<{ id: string }> }

// GET /api/products/[id] - Obtener producto especifico (usuario autenticado)
export const GET = withTenantAuth({ permission: 'products.read', module: 'inventory' }, async (
  request: NextRequest,
  { user, organization },
  routeContext?: unknown
) => {
  try {
    const { params } = routeContext as ProductRouteContext
    const { id } = await params
    const supabase = createAdminSupabase()
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
      .select('*, category:categories(id, name), variants:product_variants(*)')
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

    // Ocultar el costo (purchase_price) a quien no sea admin/super_admin ni
    // tenga el permiso específico products.read_cost.
    let costPermissions: string[] | undefined
    if (!canViewProductCost(user.role)) {
      const { data: perms } = await supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', user.id)
        .eq('permission', PRODUCT_COST_PERMISSION)
        .eq('is_active', true)
        .limit(1)
      costPermissions = perms && perms.length > 0 ? [PRODUCT_COST_PERMISSION] : []
    }
    const safeProduct = stripProductCost(responseProduct as Record<string, unknown>, user.role, costPermissions)

    return NextResponse.json({
      success: true,
      data: safeProduct,
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
export const PUT = withTenantAuth({ permission: 'products.update', module: 'inventory' }, async (
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

    // Esta ruta no persiste variantes: antes las validaba y las descartaba en
    // silencio, asi que el editor creia haber guardado. El guardado con
    // variantes vive en PUT /api/products.
    const sendsVariants = (Array.isArray(body?.variants) && body.variants.length > 0) || body?.has_variants === true
    if (sendsVariants) {
      return NextResponse.json(
        {
          success: false,
          error: 'Para guardar variantes usá PUT /api/products.',
          code: 'VARIANTS_NOT_SUPPORTED_HERE',
        },
        { status: 400 },
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
        { success: false, error: 'Error de validación', details },
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
      'tags',
      'min_stock',
      'max_stock',
      'purchase_price',
      'sale_price',
      'wholesale_price',
      'offer_price',
      'has_offer',
      'installments_enabled',
      'installments_public',
      'installments_plans',
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
      const adminSupabase = createAdminSupabase()

      // El stock previo se lee antes de escribir: es lo que va a la fila del
      // movimiento. Sin esto, reponer desde «Alertas → Reabastecer» cambiaba el
      // stock sin dejar rastro, mientras el mismo cambio hecho desde «Stock por
      // sucursal» sí quedaba registrado. La misma accion por dos puertas
      // distintas tenia dos historiales distintos.
      const { data: previousRow } = await adminSupabase
        .from('branch_inventory')
        .select('stock_quantity')
        .eq('branch_id', branchScope.branchId)
        .eq('product_id', id)
        .maybeSingle()
      const previousStock = Number(previousRow?.stock_quantity ?? 0)
      const nextStock = Number(desiredStockQuantity)

      await upsertBranchInventoryStock({
        supabase: adminSupabase as unknown as BranchInventoryClient,
        branchId: branchScope.branchId,
        productId: id,
        stockQuantity: nextStock,
      })

      if (nextStock !== previousStock) {
        const { error: movementError } = await adminSupabase
          .from('product_movements')
          .insert({
            organization_id: organization.id,
            branch_id: branchScope.branchId,
            product_id: id,
            movement_type: 'adjustment',
            quantity: Math.abs(nextStock - previousStock),
            previous_stock: previousStock,
            new_stock: nextStock,
            notes: 'Ajuste desde la ficha del producto',
            user_id: user.id,
          })

        // El stock ya se guardo: no se revierte por el historial, pero tampoco
        // se calla, porque un hueco en la trazabilidad no se recupera despues.
        if (movementError) {
          logger.error('Stock updated without movement record', {
            productId: id,
            branchId: branchScope.branchId,
            error: movementError.message,
          })
        }
      }
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
export const DELETE = withTenantAuth({ permission: 'products.delete', module: 'inventory' }, async (
  _request: NextRequest,
  { organization },
  routeContext?: unknown
) => {
  const { params } = routeContext as ProductRouteContext
  const { id } = await params
  try {
    const adminSupabase = createAdminSupabase()

    const { data: existing, error: existingError } = await adminSupabase
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

    // Verificar si el producto tiene historial de transacciones (ventas, pedidos, repuestos de taller)
    const [
      { count: salesCount },
      { count: ordersCount },
      { count: repairPartsCount },
      { count: repairCostsCount },
    ] = await Promise.all([
      adminSupabase.from('sale_items').select('id', { count: 'exact', head: true }).eq('product_id', id),
      adminSupabase.from('order_items').select('id', { count: 'exact', head: true }).eq('product_id', id),
      adminSupabase.from('repair_parts').select('id', { count: 'exact', head: true }).eq('product_id', id),
      adminSupabase.from('repair_item_costs').select('id', { count: 'exact', head: true }).eq('product_id', id),
    ])

    const hasTransactions =
      (salesCount ?? 0) > 0 ||
      (ordersCount ?? 0) > 0 ||
      (repairPartsCount ?? 0) > 0 ||
      (repairCostsCount ?? 0) > 0

    if (hasTransactions) {
      return NextResponse.json(
        {
          success: false,
          error: `"${existing.name}" no se puede eliminar porque tiene ventas o reparaciones asociadas. Podés desactivarlo para que no aparezca en ventas ni catálogo.`,
          code: 'PRODUCT_HAS_TRANSACTIONS',
        },
        { status: 409 }
      )
    }

    // Limpiar tablas auxiliares dependientes sin historial transaccional
    await Promise.allSettled([
      adminSupabase.from('cart_items').delete().eq('product_id', id),
      adminSupabase.from('branch_variant_inventory').delete().eq('product_id', id),
      adminSupabase.from('branch_inventory').delete().eq('product_id', id),
      adminSupabase.from('variant_inventory_movements').delete().eq('product_id', id),
      adminSupabase.from('product_movements').delete().eq('product_id', id),
      adminSupabase.from('product_variants').delete().eq('product_id', id),
    ])

    const { error: deleteError } = await adminSupabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('organization_id', organization.id)

    if (deleteError) {
      logger.error('Failed to delete product by id', { productId: id, error: deleteError.message, code: deleteError.code })
      throw deleteError
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Producto eliminado exitosamente',
        deleted_product: existing,
      },
    })
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string; details?: string }
    logger.error('Product delete by id API error', { productId: id, error: err?.message || error })

    const isFkConstraint =
      err?.code === '23503' ||
      (typeof err?.message === 'string' && /foreign key|referenc|constraint/i.test(err.message))

    const message = isFkConstraint
      ? 'No se puede eliminar el producto porque está referenciado en otros registros del sistema (ventas, compras o movimientos). Podés desactivarlo u ocultarlo del catálogo.'
      : (err?.message || 'Error al eliminar el producto')

    return NextResponse.json(
      {
        success: false,
        error: message,
        code: err?.code || 'DELETE_PRODUCT_FAILED',
        details: err?.details || err?.message,
      },
      { status: isFkConstraint ? 409 : 500 }
    )
  }
})

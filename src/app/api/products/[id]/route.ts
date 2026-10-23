import { resolveOrganizationProductCostAccess, redactProductCosts, hasExplicitProductCost, prepareProductCostInput, changesForeignCostCurrency, ProductCostInputError, hydrateProductCostsFromService } from '@/lib/products/cost-access'
import { productReferencesBelongToOrganization } from '@/lib/products/tenant-references'
import { NextRequest, NextResponse } from 'next/server'
import { conflictMessage, findProductConflict } from '@/lib/products/uniqueness'
import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { ProductBrandError, resolveProductBrand } from '@/lib/products/product-brand'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { productUpdateSchema } from '@/lib/validation/schemas'
import { foreignPriceColumns, foreignPriceErrorMessage, productsHaveForeignPriceColumns } from '@/lib/products/foreign-price'
import { logger } from '@/lib/logger'
import {
  type AppRole,
} from '@/lib/auth/role-utils'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'
import {
  applyBranchInventoryToProducts,
  loadBranchInventoryStockMap,
  upsertBranchInventoryStock,
  type BranchInventoryClient,
} from '@/lib/branches/inventory'
import { PRODUCT_CLIENT_COLUMNS } from '@/lib/products/cost-columns'

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

    const costAccess = await resolveOrganizationProductCostAccess(createAdminSupabase(), {userId:user.id,organizationId:organization.id})
    const safeProduct = redactProductCosts(responseProduct as Record<string, unknown>, costAccess)

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
    const rawBody = await request.json().catch(() => null)
    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      return NextResponse.json({ success: false, error: 'El cuerpo debe ser un objeto JSON válido.' }, { status: 400 })
    }
    const costClient = createAdminSupabase()
    const costAccess = await resolveOrganizationProductCostAccess(costClient, {userId:user.id,organizationId:organization.id})
    if (!costAccess.canWriteCost && (hasExplicitProductCost(rawBody) || await changesForeignCostCurrency(costClient, rawBody, organization.id, id))) {
      return NextResponse.json({success:false,error:'No tenés permiso para modificar costos en esta organización.',code:'PRODUCT_COST_FORBIDDEN'}, {status:403})
    }
    const body = await prepareProductCostInput(costClient, rawBody, organization.id, id)

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
    if (!await productReferencesBelongToOrganization(costClient, organization.id, validated)) {
      return NextResponse.json({ success: false, error: 'La categoría o el proveedor no pertenecen a esta organización.', code: 'PRODUCT_REFERENCE_FORBIDDEN' }, { status: 400 })
    }
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

    const conflict = await findProductConflict(supabase as never, {
      organizationId: organization.id, sku: validated.sku, barcode: validated.barcode, excludeId: id,
    })
    if (conflict) return NextResponse.json({ success: false, error: conflictMessage(conflict), code: 'PRODUCT_CONFLICT' }, { status: 409 })

    const updatePayload: Record<string, unknown> = {}
    // Only consider stock_quantity if the client explicitly sent it
    const desiredStockQuantity = 'stock_quantity' in body && body.stock_quantity !== undefined
      ? validated.stock_quantity
      : undefined

    const allowedKeys: Array<keyof typeof validated> = [
      'name',
      'sku',
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
      'featured',
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

    if (await productsHaveForeignPriceColumns(supabase as never)) {
      Object.assign(updatePayload, foreignPriceColumns(validated, (key) => key in body))
      if (!('foreign_purchase_price' in body)) delete updatePayload.foreign_purchase_price
    }

    // Marca: si se tocó, el texto y el vínculo quedan de acuerdo. Si llega
    // solo uno de los dos, el otro sale de lo guardado.
    if ('brand' in body || 'brand_id' in body) {
      const { data: current } = await createAdminSupabase()
        .from('products')
        .select('brand, brand_id')
        .eq('id', id)
        .eq('organization_id', organization.id)
        .maybeSingle()
      try {
        Object.assign(updatePayload, await resolveProductBrand(createAdminSupabase(), organization.id, {
          brand: 'brand' in body ? validated.brand : (current as { brand?: string | null } | null)?.brand,
          // Texto nuevo sin vínculo: se busca la marca por el texto.
          brand_id: 'brand_id' in body ? validated.brand_id : 'brand' in body ? null : (current as { brand_id?: string | null } | null)?.brand_id,
        }))
      } catch (error) {
        if (error instanceof ProductBrandError) {
          return NextResponse.json({ success: false, error: error.message, code: 'INVALID_BRAND', field: 'brand_id' }, { status: 400 })
        }
        throw error
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
        .select(`${PRODUCT_CLIENT_COLUMNS}, category:categories(id, name)`)
        .maybeSingle()

      if (error) {
        const foreignPriceError = foreignPriceErrorMessage(error)
        if (foreignPriceError) {
          return NextResponse.json({ success: false, error: foreignPriceError, code: 'EXCHANGE_RATE_MISSING', field: 'price_currency' }, { status: 400 })
        }
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
      .select(`${PRODUCT_CLIENT_COLUMNS}, category:categories(id, name)`)
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

    // El costo ya no vuelve por la sesión del usuario (S1): se completa desde el
    // cliente de servicio y se oculta abajo según el permiso, como antes.
    updatedProduct = (await hydrateProductCostsFromService(costClient, organization.id, [refreshedProduct as Record<string, unknown> & { id: string }]))[0] as Record<string, unknown>

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
      data: redactProductCosts(responseProduct as Record<string, unknown>, costAccess),
    })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('[PRODUCTS PUT] Update failed:', errMsg, error)
    if ((error as { code?: string })?.code === '23505') {
      return NextResponse.json({ success: false, error: 'Ya existe un producto con este SKU en la organización.', code: 'SKU_ALREADY_EXISTS' }, { status: 409 })
    }
    if (error instanceof ProductCostInputError) {
      return NextResponse.json({success:false,error:error.message,code:'INVALID_VARIANT_SCOPE'},{status:400})
    }
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
  { organization, user },
  routeContext?: unknown
) => {
  const { params } = routeContext as ProductRouteContext
  const { id } = await params
  try {
    const costAccess = await resolveOrganizationProductCostAccess(createAdminSupabase(), {userId:user.id,organizationId:organization.id})
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
        deleted_product: redactProductCosts(existing as Record<string,unknown>,costAccess),
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

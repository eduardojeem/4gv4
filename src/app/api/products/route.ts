import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { productSchema, productUpdateSchema } from '@/lib/validation/schemas'
import type { AppRole } from '@/lib/auth/role-utils'
import { stripProductCost, canViewProductCost, PRODUCT_COST_PERMISSION } from '@/lib/auth/role-utils'
import { getRequestedBranchId, getDefaultBranch, resolveBranchScopeForUser } from '@/lib/branches/server'
import { applyBranchInventoryToProducts, loadBranchInventoryStockMap, upsertBranchInventoryStock } from '@/lib/branches/inventory'
import { canCreateResource } from '@/lib/saas/subscription-service'
import { filterProductsByCatalogKind, parseProductCatalogKind } from '@/lib/products/catalog-kind'
import { ProductVariantsPayloadSchema } from '@/lib/products/variant-contract'

// GET /api/products - Get products with variants
/**
 * Cuantas filas se barren cuando el filtro de stock obliga a resolver en
 * memoria. Generoso para cubrir catalogos grandes sin traer la tabla entera.
 */
const IN_MEMORY_STOCK_FILTER_CAP = 5000

const VARIANT_ERROR_STATUS: Record<string, number> = {
  VARIANT_SKU_DUPLICATE: 409,
  VARIANT_BARCODE_DUPLICATE: 409,
  VARIANT_STOCK_INSUFFICIENT: 409,
  VARIANT_BRANCH_FORBIDDEN: 403,
  VARIANT_ACTOR_FORBIDDEN: 403,
  VARIANT_PRODUCT_NOT_IN_ORGANIZATION: 404,
}

function getVariantErrorCode(error: { message?: string | null }): string | null {
  const message = error.message ?? ''
  return Object.keys(VARIANT_ERROR_STATUS).find((code) => message.includes(code)) ?? null
}

function toVariantRpcRows(variants: Array<{
  id?: string
  name: string
  attributes: Record<string, string>
  sku?: string
  barcode?: string
  purchasePrice: number
  salePrice: number
  wholesalePrice?: number
  minStock: number
  stockQuantity: number
  isActive: boolean
}>) {
  return variants.map((variant) => ({
    id: variant.id,
    name: variant.name,
    attributes: variant.attributes,
    sku: variant.sku ?? '',
    barcode: variant.barcode,
    purchase_price: variant.purchasePrice,
    sale_price: variant.salePrice,
    wholesale_price: variant.wholesalePrice,
    min_stock: variant.minStock,
    stock_quantity: variant.stockQuantity,
    is_active: variant.isActive,
  }))
}

export const GET = withTenantAuth({ permission: 'products.read', module: 'inventory' }, async (request, { user, organization }) => {
  try {
    const { searchParams } = new URL(request.url)
    
    const query = searchParams.get('query')
    const categoryId = searchParams.get('category_id')
    const supplierId = searchParams.get('supplier_id')
    const brand = searchParams.get('brand')
    const requestedStockStatus = searchParams.get('stock_status')
    const stockStatus = requestedStockStatus === 'low_stock' ||
      requestedStockStatus === 'out_of_stock' ||
      requestedStockStatus === 'normal_stock' ||
      requestedStockStatus === 'high_stock'
      ? requestedStockStatus
      : searchParams.get('in_stock') === 'true' || requestedStockStatus === 'in_stock'
        ? 'in_stock'
        : 'all'
    const priceMinParam = searchParams.get('price_min')
    const priceMaxParam = searchParams.get('price_max')
    const priceMin = priceMinParam === null ? null : Number(priceMinParam)
    const priceMax = priceMaxParam === null ? null : Number(priceMaxParam)
    const stockMinParam = searchParams.get('stock_min')
    const stockMaxParam = searchParams.get('stock_max')
    const stockMin = stockMinParam === null ? null : Number(stockMinParam)
    const stockMax = stockMaxParam === null ? null : Number(stockMaxParam)
    const hasImage = searchParams.get('has_image') === 'true'
    const createdFrom = searchParams.get('created_from')
    const createdTo = searchParams.get('created_to')
    const updatedFrom = searchParams.get('updated_from')
    const updatedTo = searchParams.get('updated_to')
    const isActive = searchParams.get('is_active')
    const featured = searchParams.get('featured')
    const requestedSort = searchParams.get('sort') || 'name'
    const sortColumns: Record<string, string> = {
      name: 'name',
      sku: 'sku',
      category: 'category_id',
      price: 'sale_price',
      stock: 'stock_quantity',
      supplier: 'supplier_id',
      margin: 'sale_price',
      created_at: 'created_at',
    }
    const sortColumn = sortColumns[requestedSort] || 'name'
    const sortAscending = searchParams.get('direction') !== 'desc'
    const strictBranchStock = searchParams.get('strict_branch_stock') === 'true'
    const catalogKind = parseProductCatalogKind(searchParams.get('catalog_kind'))
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1)
    const perPage = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('per_page') || '50', 10) || 50))
    const requestedBranchId = getRequestedBranchId(request)
    
    const branchScope = await resolveBranchScopeForUser({
      userId: user.id,
      role: user.role as AppRole | undefined,
      requestedBranchId,
      organizationId: organization.id,
      strict: Boolean(requestedBranchId),
    })
    // Authentication, permission and tenant scope were resolved above. Use the
    // server client for a stable read contract instead of depending on browser
    // RLS policies that can drift from the dashboard permission model.
    const supabase = createAdminSupabase()
    
    // Build query
    let queryBuilder = supabase
      .from('products')
      .select(`
        *,
        category:categories(id, name, description),
        supplier:suppliers(id, name, contact_name, phone, address)
      `, { count: 'exact' })
      .eq('organization_id', organization.id)
      // Lo archivado por el ciclo de baja de plan sale del catalogo operativo:
      // la fila se conserva para no romper el historico de ventas.
      .is('archived_by_plan_at', null)
    
    // Apply filters
    if (query) {
      const safeQuery = query.replace(/[,%()]/g, ' ').trim()
      queryBuilder = queryBuilder.or(
        `name.ilike.%${safeQuery}%,sku.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%,brand.ilike.%${safeQuery}%,barcode.eq.${safeQuery}`
      )
    }
    
    if (categoryId) {
      queryBuilder = queryBuilder.eq('category_id', categoryId)
    }

    if (supplierId) {
      queryBuilder = queryBuilder.eq('supplier_id', supplierId)
    }
    
    if (brand) {
      queryBuilder = queryBuilder.ilike('brand', brand)
    }

    if (priceMin !== null && Number.isFinite(priceMin)) {
      queryBuilder = queryBuilder.gte('sale_price', priceMin)
    }

    if (priceMax !== null && Number.isFinite(priceMax)) {
      queryBuilder = queryBuilder.lte('sale_price', priceMax)
    }

    if (isActive === 'true' || isActive === 'false') {
      queryBuilder = queryBuilder.eq('is_active', isActive === 'true')
    }

    if (featured === 'true' || featured === 'false') {
      queryBuilder = queryBuilder.eq('featured', featured === 'true')
    }

    if (hasImage) queryBuilder = queryBuilder.not('image_url', 'is', null)
    if (createdFrom) queryBuilder = queryBuilder.gte('created_at', createdFrom)
    if (createdTo) queryBuilder = queryBuilder.lt('created_at', createdTo)
    if (updatedFrom) queryBuilder = queryBuilder.gte('updated_at', updatedFrom)
    if (updatedTo) queryBuilder = queryBuilder.lt('updated_at', updatedTo)

    if (stockStatus === 'in_stock' && !branchScope.branchId) {
      queryBuilder = queryBuilder.gt('stock_quantity', 0)
    } else if (stockStatus === 'out_of_stock' && !branchScope.branchId) {
      queryBuilder = queryBuilder.eq('stock_quantity', 0)
    } else if (stockStatus === 'low_stock' && !branchScope.branchId) {
      queryBuilder = queryBuilder.gt('stock_quantity', 0)
    }
    
    const from = (page - 1) * perPage
    const to = from + perPage - 1
    const needsInMemoryPagination =
      stockStatus !== 'all' ||
      stockMin !== null ||
      stockMax !== null ||
      catalogKind !== null

    queryBuilder = queryBuilder.order(sortColumn, { ascending: sortAscending })
    if (!needsInMemoryPagination) {
      queryBuilder = queryBuilder.range(from, to)
    } else {
      // Los filtros de stock se resuelven en memoria: con sucursal activa el
      // stock sale del inventario por sucursal, y "stock bajo" compara contra
      // `min_stock`, que PostgREST no puede filtrar columna contra columna.
      //
      // Sin un tope explicito la consulta quedaba sujeta al limite implicito de
      // PostgREST (1000 filas): los productos que caian fuera desaparecian del
      // listado Y del total, sin ninguna senal. Ahora el tope es propio y, si se
      // alcanza, se avisa en la respuesta.
      // Se pide una fila adicional para detectar de forma confiable si el
      // barrido quedó truncado (los rangos de PostgREST son inclusivos).
      queryBuilder = queryBuilder.range(0, IN_MEMORY_STOCK_FILTER_CAP)
    }

    const { data: products, error, count } = await queryBuilder
    
    if (error) {
      logger.error('Failed to fetch products', { error: error.message, code: error.code, details: error.details, hint: error.hint })
      // Se distingue del catch general: asi el cliente sabe que fallo la lectura
      // del catalogo y no otra parte del pedido.
      return NextResponse.json(
        {
          success: false,
          code: error.code ?? 'PRODUCTS_QUERY_FAILED',
          error: 'No se pudo leer el catálogo de productos.',
        },
        { status: 500 }
      )
    }
    
    const baseProducts = (products || []) as Array<Record<string, unknown> & { id: string; stock_quantity?: number | null }>
    const branchInventoryClient = supabase as unknown as Parameters<typeof loadBranchInventoryStockMap>[0]
    const { stockMap, branchScoped } = await loadBranchInventoryStockMap(
      branchInventoryClient,
      branchScope.branchId,
      baseProducts.map((product) => product.id)
    )
    const cappedProducts = baseProducts.slice(0, IN_MEMORY_STOCK_FILTER_CAP)
    const branchAwareProducts = strictBranchStock && branchScope.branchId
      ? cappedProducts.map((product) => {
          const branchStock = Number(stockMap.get(product.id) || 0)
          return {
            ...product,
            stock_quantity: branchStock,
            branch_stock_quantity: branchStock,
          }
        })
      : applyBranchInventoryToProducts(cappedProducts, stockMap, branchScoped)
    const stockFilteredProducts = branchAwareProducts.filter((product) => {
      const stock = Number(product.stock_quantity || 0)
      if (stockStatus === 'in_stock' && stock <= 0) return false
      if (stockStatus === 'out_of_stock' && stock > 0) return false
      if (stockStatus === 'low_stock' && !(stock > 0 && stock <= Number(product.min_stock || 0))) return false
      if (
        stockStatus === 'normal_stock' &&
        !(stock > Number(product.min_stock || 0) && stock < Number(product.max_stock || 0))
      ) return false
      if (stockStatus === 'high_stock' && stock < Number(product.max_stock || 0)) return false
      if (stockMin !== null && Number.isFinite(stockMin) && stock < stockMin) return false
      if (stockMax !== null && Number.isFinite(stockMax) && stock > stockMax) return false
      return true
    })
    const catalogFilteredProducts = filterProductsByCatalogKind(stockFilteredProducts, catalogKind)
    const filteredProducts = needsInMemoryPagination
      ? catalogFilteredProducts.slice(from, to + 1)
      : catalogFilteredProducts
    const filteredTotal = needsInMemoryPagination ? catalogFilteredProducts.length : (count || 0)
    // Se alcanzo el tope del barrido: lo listado y el total son parciales.
    const truncated = needsInMemoryPagination && baseProducts.length > IN_MEMORY_STOCK_FILTER_CAP

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
    const visibleProducts = filteredProducts.map((product) =>
      stripProductCost(product as Record<string, unknown>, user.role, costPermissions)
    )

    return NextResponse.json({
      success: true,
      data: {
        products: visibleProducts,
        total: filteredTotal,
        page,
        per_page: perPage,
        // Cuando es true el listado y el total son parciales: el filtro de stock
        // barrio hasta el tope y quedaron productos sin evaluar.
        truncated,
        scan_cap: truncated ? IN_MEMORY_STOCK_FILTER_CAP : undefined,
      }
    })
  } catch (error) {
    // "Failed to fetch products" no le decia nada a nadie y tapaba la causa:
    // se registra el detalle y se devuelve algo accionable.
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Products API error', { error, message })
    return NextResponse.json(
      {
        success: false,
        code: 'PRODUCTS_UNEXPECTED_ERROR',
        error: `No se pudieron cargar los productos: ${message}`,
      },
      { status: 500 }
    )
  }
})

// POST /api/products - Create new product
export const POST = withTenantAuth({ permission: 'products.create', module: 'inventory' }, async (request, { user, organization }) => {
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
        error: 'Error de validación',
        code: 'VALIDATION_FAILED',
        details: errors
      }, { status: 400 })
    }
    
    const validated = validationResult.data
    const resourceType = validated.unit_measure === 'servicio' ? 'services' : 'products'
    const resourceLabel = resourceType === 'services' ? 'servicio' : 'producto'
    const planGate = await canCreateResource(organization.id, resourceType)

    if (!planGate.allowed) {
      const planName = planGate.plan?.name || planGate.plan?.code || 'actual'
      const limitText = planGate.limit === null ? 'ilimitados' : String(planGate.limit)
      return NextResponse.json(
        {
          success: false,
          error: planGate.blocked
            ? `No se puede crear el ${resourceLabel} porque la suscripcion esta suspendida o cancelada. Reactiva la suscripcion para habilitar mas.`
            : planGate.expired
              ? `No hay cupo para crear este ${resourceLabel}. Como el plan vencio, la organizacion quedo con el limite Free de ${limitText} ${resourceType}. Elimina ${resourceType} que no uses o actualiza el plan.`
              : `No hay cupo para crear este ${resourceLabel}. El plan ${planName} permite ${limitText} ${resourceType}. Elimina ${resourceType} que no uses o actualiza el plan.`,
          code: planGate.blocked ? 'SUBSCRIPTION_BLOCKED' : 'PLAN_LIMIT_REACHED',
          resource: resourceType,
          current: planGate.current,
          limit: planGate.limit,
        },
        { status: 402 }
      )
    }

    if (validated.has_variants) {
      const variantPayload = ProductVariantsPayloadSchema.safeParse({
        hasVariants: true,
        attributes: validated.variant_attribute_config,
        variants: validated.variants,
      })

      if (!variantPayload.success) {
        return NextResponse.json({
          success: false,
          error: 'Error de validación',
          code: 'VALIDATION_FAILED',
          details: variantPayload.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        }, { status: 400 })
      }

      const variantBranchId = branchScope.branchId ?? defaultBranch?.id
      if (!variantBranchId) {
        return NextResponse.json(
          { success: false, error: 'Seleccioná una sucursal para asignar el stock de las variantes.', code: 'BRANCH_REQUIRED' },
          { status: 400 },
        )
      }

      const admin = createAdminSupabase()
      const { data: saved, error: saveError } = await admin.rpc('save_product_with_variants', {
        p_product: {
          ...validated,
          organization_id: organization.id,
          variant_attribute_config: variantPayload.data.attributes,
        },
        p_variants: toVariantRpcRows(variantPayload.data.variants),
        p_branch_id: variantBranchId,
        p_actor_id: user.id,
      })

      if (saveError) {
        const code = getVariantErrorCode(saveError)
        logger.error('Failed to create product with variants', {
          code: code ?? saveError.code,
          error: saveError.message,
          organizationId: organization.id,
        })
        return NextResponse.json(
          {
            success: false,
            error: code === 'VARIANT_SKU_DUPLICATE'
              ? 'Ya existe una variante con ese SKU en la organización.'
              : code === 'VARIANT_BARCODE_DUPLICATE'
                ? 'Ya existe una variante con ese código de barras en la organización.'
                : 'No se pudo guardar el producto con sus variantes.',
            code: code ?? 'PRODUCT_VARIANTS_SAVE_FAILED',
          },
          { status: code ? VARIANT_ERROR_STATUS[code] : 500 },
        )
      }

      const savedProductId = String((saved as { product_id?: unknown } | null)?.product_id ?? '')
      const [{ data: product, error: productError }, { data: variants, error: variantsError }] = await Promise.all([
        admin.from('products').select('*').eq('id', savedProductId).eq('organization_id', organization.id).single(),
        admin.from('product_variants').select('*').eq('product_id', savedProductId).eq('organization_id', organization.id).order('created_at'),
      ])

      if (productError || variantsError || !product) {
        logger.error('Failed to reload product variants after save', {
          productId: savedProductId,
          productError: productError?.message,
          variantsError: variantsError?.message,
        })
        return NextResponse.json(
          { success: false, error: 'El producto se guardó, pero no se pudo recargar.', code: 'PRODUCT_VARIANTS_RELOAD_FAILED' },
          { status: 500 },
        )
      }

      const canReadCost = canViewProductCost(user.role)
      const visibleVariants = (variants ?? []).map((variant) => {
        if (canReadCost) return variant
        const { purchase_price: _purchasePrice, ...visible } = variant
        return visible
      })

      return NextResponse.json({
        success: true,
        data: {
          product: stripProductCost(product as Record<string, unknown>, user.role),
          variants: visibleVariants,
        },
      }, { status: 201 })
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
        brand_id: validated.brand_id,
        tags: validated.tags,
        stock_quantity: shouldZeroGlobalStock ? 0 : requestedStock,
        min_stock: validated.min_stock,
        max_stock: validated.max_stock,
        purchase_price: validated.purchase_price,
        sale_price: validated.sale_price,
        wholesale_price: validated.wholesale_price,
        offer_price: validated.offer_price,
        has_offer: validated.has_offer,
        installments_enabled: validated.installments_enabled,
        installments_public: validated.installments_public,
        installments_plans: validated.installments_plans,
        is_active: validated.is_active,
        visibility: validated.visibility,
        warranty_months: validated.warranty_months,
        warranty_info: validated.warranty_info,
        return_window_days: validated.return_window_days,
        exchange_window_days: validated.exchange_window_days,
        return_policy: validated.return_policy,
        exchange_policy: validated.exchange_policy,
        images: validated.images,
        image_url: validated.image_url,
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
          { success: false, error: 'Ya existe un producto con este SKU.', code: 'SKU_ALREADY_EXISTS' },
          { status: 409 }
        )
      }
      
      throw error
    }

    if (branchScopedCreate && branchScope.branchId) {
      try {
        // Tenant, permission, and branch scope were already validated above.
        // Use service role only for this scoped write because branch_inventory
        // RLS can otherwise reject the post-insert synchronization.
        const branchInventoryClient = createAdminSupabase() as unknown as Parameters<typeof upsertBranchInventoryStock>[0]['supabase']

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

        await createAdminSupabase()
          .from('products')
          .delete()
          .eq('id', product.id)
          .eq('organization_id', organization.id)

        return NextResponse.json(
          { success: false, error: 'No se pudo sincronizar el stock inicial de la sucursal.', code: 'BRANCH_STOCK_SYNC_FAILED' },
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
      { success: false, error: 'No se pudo crear el producto.', code: 'PRODUCT_CREATE_FAILED' },
      { status: 500 }
    )
  }
})

// PUT /api/products - Update product
export const PUT = withTenantAuth({ permission: 'products.update', module: 'inventory' }, async (request, { user, organization }) => {
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
        error: 'Error de validación',
        details: errors
      }, { status: 400 })
    }
    
    const validated = validationResult.data
    const { data: existingProduct, error: existingProductError } = await supabase
      .from('products')
      .select('*')
      .eq('id', validated.id)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (existingProductError) {
      logger.error('Failed to verify product tenant before update', {
        productId: validated.id,
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

    if (validated.has_variants !== undefined && (validated.has_variants || existingProduct.has_variants)) {
      const variantPayload = ProductVariantsPayloadSchema.safeParse({
        hasVariants: validated.has_variants,
        attributes: validated.variant_attribute_config ?? existingProduct.variant_attribute_config ?? [],
        variants: validated.variants ?? [],
      })

      if (!variantPayload.success) {
        return NextResponse.json({
          success: false,
          error: 'Error de validación',
          code: 'VALIDATION_FAILED',
          details: variantPayload.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        }, { status: 400 })
      }

      const variantBranchId = branchScope.branchId ?? (await getDefaultBranch(organization.id))?.id
      if (!variantBranchId) {
        return NextResponse.json(
          { success: false, error: 'Seleccioná una sucursal para actualizar las variantes.', code: 'BRANCH_REQUIRED' },
          { status: 400 },
        )
      }

      const admin = createAdminSupabase()
      const { data: saved, error: saveError } = await admin.rpc('save_product_with_variants', {
        p_product: {
          ...existingProduct,
          ...validated,
          id: validated.id,
          organization_id: organization.id,
          has_variants: variantPayload.data.hasVariants,
          variant_attribute_config: variantPayload.data.attributes,
        },
        p_variants: toVariantRpcRows(variantPayload.data.variants),
        p_branch_id: variantBranchId,
        p_actor_id: user.id,
      })

      if (saveError) {
        const code = getVariantErrorCode(saveError)
        return NextResponse.json(
          {
            success: false,
            error: 'No se pudo actualizar el producto con sus variantes.',
            code: code ?? 'PRODUCT_VARIANTS_SAVE_FAILED',
          },
          { status: code ? VARIANT_ERROR_STATUS[code] : 500 },
        )
      }

      const savedProductId = String((saved as { product_id?: unknown } | null)?.product_id ?? validated.id)
      const [{ data: product, error: productError }, { data: variants, error: variantsError }] = await Promise.all([
        admin.from('products').select('*').eq('id', savedProductId).eq('organization_id', organization.id).single(),
        admin.from('product_variants').select('*').eq('product_id', savedProductId).eq('organization_id', organization.id).order('created_at'),
      ])

      if (productError || variantsError || !product) {
        return NextResponse.json(
          { success: false, error: 'El producto se actualizó, pero no se pudo recargar.', code: 'PRODUCT_VARIANTS_RELOAD_FAILED' },
          { status: 500 },
        )
      }

      const visibleVariants = (variants ?? []).map((variant) => {
        if (canViewProductCost(user.role)) return variant
        const { purchase_price: _purchasePrice, ...visible } = variant
        return visible
      })

      return NextResponse.json({
        success: true,
        data: {
          product: stripProductCost(product as Record<string, unknown>, user.role),
          variants: visibleVariants,
        },
      })
    }

    const desiredStockQuantity = validated.stock_quantity
    const updatePayload: Record<string, unknown> = {
      name: validated.name,
      description: validated.description,
      category_id: validated.category_id,
      supplier_id: validated.supplier_id,
      brand: validated.brand,
      brand_id: validated.brand_id,
        tags: validated.tags,
      min_stock: validated.min_stock,
      max_stock: validated.max_stock,
      purchase_price: validated.purchase_price,
      sale_price: validated.sale_price,
      wholesale_price: validated.wholesale_price,
      offer_price: validated.offer_price,
      has_offer: validated.has_offer,
      installments_enabled: validated.installments_enabled,
      installments_public: validated.installments_public,
      installments_plans: validated.installments_plans,
      is_active: validated.is_active,
      visibility: validated.visibility,
      warranty_months: validated.warranty_months,
      warranty_info: validated.warranty_info,
      return_window_days: validated.return_window_days,
      exchange_window_days: validated.exchange_window_days,
      return_policy: validated.return_policy,
      exchange_policy: validated.exchange_policy,
      images: validated.images,
      image_url: validated.image_url,
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
        supabase: createAdminSupabase() as unknown as Parameters<typeof upsertBranchInventoryStock>[0]['supabase'],
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
export const DELETE = withTenantAuth({ permission: 'products.delete', module: 'inventory' }, async (request, { user, organization }) => {
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

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireStaff, getAuthResponse } from '@/lib/auth/require-auth'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

type ProductSummaryRow = {
  sale_price: number | null
  wholesale_price: number | null
  purchase_price: number | null
  min_stock: number | null
  max_stock: number | null
}

type VariantAttributeValue = {
  attribute_id: string
  attribute_name: string
  option_id: string
  value: string
  display_value?: string
  color_hex?: string
}

type ProductVariantRow = {
  id: string
  product_id: string
  sku: string | null
  variant_name: string | null
  price_adjustment: number | null
  stock_quantity: number | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
  product?: ProductSummaryRow | ProductSummaryRow[] | null
  attributes?: VariantAttributeValue[] | null
}

function toSafeNumber(value: unknown, fallback = 0): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function normalizeAttributeValues(value: unknown): VariantAttributeValue[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => {
      const item = entry as Record<string, unknown>
      return {
        attribute_id: String(item.attribute_id ?? ''),
        attribute_name: String(item.attribute_name ?? ''),
        option_id: String(item.option_id ?? ''),
        value: String(item.value ?? ''),
        display_value: item.display_value ? String(item.display_value) : undefined,
        color_hex: item.color_hex ? String(item.color_hex) : undefined,
      }
    })
    .filter((entry) => entry.attribute_id && entry.option_id && entry.value)
}

function normalizeProductSummary(value: unknown): ProductSummaryRow | null {
  if (Array.isArray(value)) {
    const [first] = value
    if (first && typeof first === 'object') {
      return first as ProductSummaryRow
    }
    return null
  }

  if (value && typeof value === 'object') {
    return value as ProductSummaryRow
  }

  return null
}

function mapVariantRow(row: ProductVariantRow) {
  const product = normalizeProductSummary(row.product)
  const basePrice = toSafeNumber(product?.sale_price, 0)
  const baseWholesalePrice = toSafeNumber(product?.wholesale_price, 0)
  const baseCostPrice = toSafeNumber(product?.purchase_price, 0)
  const priceAdjustment = toSafeNumber(row.price_adjustment, 0)

  const price = basePrice + priceAdjustment
  const wholesalePrice = baseWholesalePrice > 0 ? baseWholesalePrice + priceAdjustment : undefined
  const costPrice = baseCostPrice > 0 ? baseCostPrice : undefined

  const minStock = toSafeNumber(product?.min_stock, 0)
  const maxStockNumber = toSafeNumber(product?.max_stock, NaN)
  const maxStock = Number.isFinite(maxStockNumber) ? maxStockNumber : undefined

  return {
    id: row.id,
    product_id: row.product_id,
    sku: row.sku ?? '',
    name: row.variant_name ?? row.sku ?? `Variante ${row.id.slice(0, 8)}`,
    attributes: normalizeAttributeValues(row.attributes),
    price,
    wholesale_price: wholesalePrice,
    cost_price: costPrice,
    stock: toSafeNumber(row.stock_quantity, 0),
    min_stock: minStock,
    max_stock: maxStock,
    active: row.is_active !== false,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  }
}

function isTruthy(value: string | null): boolean {
  return value === 'true' || value === '1'
}

// GET /api/variants - Obtener todas las variantes con filtros
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    {
      const response = getAuthResponse(auth)
      if (response) return response
    }

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('product_id')
    const sku = searchParams.get('sku')
    const active = searchParams.get('active')
    const lowStock = isTruthy(searchParams.get('low_stock'))
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '50', 10)))

    const supabase = await createClient()
    let query = supabase
      .from('product_variants')
      .select('*, product:products(sale_price, wholesale_price, purchase_price, min_stock, max_stock)')
      .order('created_at', { ascending: false })

    if (productId) {
      query = query.eq('product_id', productId)
    }

    if (sku) {
      query = query.ilike('sku', `%${sku}%`)
    }

    if (active !== null) {
      query = query.eq('is_active', isTruthy(active))
    }

    const { data, error } = await query

    if (error) {
      logger.error('Failed to fetch product variants', { error: error.message })
      throw error
    }

    const mappedVariants = ((data || []) as ProductVariantRow[]).map(mapVariantRow)
    const filteredVariants = lowStock
      ? mappedVariants.filter((variant) => variant.stock <= variant.min_stock)
      : mappedVariants

    const startIndex = (page - 1) * limit
    const paginatedVariants = filteredVariants.slice(startIndex, startIndex + limit)

    return NextResponse.json({
      success: true,
      data: paginatedVariants,
      pagination: {
        page,
        limit,
        total: filteredVariants.length,
        pages: Math.ceil(filteredVariants.length / limit),
      },
    })
  } catch (error) {
    logger.error('Variants GET API error', { error })
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// POST /api/variants - Crear nueva variante (staff only)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaff()
    {
      const response = getAuthResponse(auth)
      if (response) return response
    }

    const body = await request.json()
    const productId = String(body?.product_id || '').trim()
    const sku = String(body?.sku || '').trim()
    const name = String(body?.name || '').trim()

    if (!productId || !sku || !name) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos: product_id, sku, name' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data: existingVariant, error: existingVariantError } = await supabase
      .from('product_variants')
      .select('id')
      .eq('sku', sku)
      .maybeSingle()

    if (existingVariantError) {
      logger.error('Failed to validate unique variant sku', {
        sku,
        error: existingVariantError.message,
      })
      throw existingVariantError
    }

    if (existingVariant) {
      return NextResponse.json(
        { success: false, error: 'El SKU ya existe' },
        { status: 409 }
      )
    }

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, sale_price')
      .eq('id', productId)
      .maybeSingle()

    if (productError) {
      logger.error('Failed to load product for variant insert', {
        productId,
        error: productError.message,
      })
      throw productError
    }

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado para crear la variante' },
        { status: 404 }
      )
    }

    const salePrice = toSafeNumber(product.sale_price, 0)
    const price =
      body?.price !== undefined ? toSafeNumber(body.price, salePrice) : salePrice
    const priceAdjustment =
      body?.price_adjustment !== undefined
        ? toSafeNumber(body.price_adjustment, 0)
        : price - salePrice

    const { data: insertedVariant, error: insertError } = await supabase
      .from('product_variants')
      .insert({
        product_id: productId,
        sku,
        variant_name: name,
        price_adjustment: priceAdjustment,
        stock_quantity: Math.max(0, toSafeNumber(body?.stock, 0)),
        is_active: body?.active !== false,
      })
      .select('*, product:products(sale_price, wholesale_price, purchase_price, min_stock, max_stock)')
      .single()

    if (insertError) {
      logger.error('Failed to insert product variant', {
        productId,
        sku,
        error: insertError.message,
      })
      throw insertError
    }

    return NextResponse.json(
      {
        success: true,
        data: mapVariantRow(insertedVariant as ProductVariantRow),
      },
      { status: 201 }
    )
  } catch (error) {
    logger.error('Variants POST API error', { error })
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// PUT /api/variants - Actualización masiva de variantes (staff only)
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireStaff()
    {
      const response = getAuthResponse(auth)
      if (response) return response
    }

    const body = await request.json()
    const variants = Array.isArray(body?.variants) ? body.variants : null

    if (!variants) {
      return NextResponse.json(
        { success: false, error: 'Se esperaba un array de variantes' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const updatedVariants: ProductVariantRow[] = []

    for (const variantData of variants) {
      if (!variantData?.id) continue

      const variantId = String(variantData.id)
      const { data: existing, error: existingError } = await supabase
        .from('product_variants')
        .select('id, sku, product:products(sale_price)')
        .eq('id', variantId)
        .maybeSingle()

      if (existingError) {
        logger.error('Failed to load variant for bulk update', {
          variantId,
          error: existingError.message,
        })
        throw existingError
      }

      if (!existing) continue

      const patch: Record<string, unknown> = {}

      if (variantData.sku !== undefined) {
        const nextSku = String(variantData.sku).trim()
        if (!nextSku) {
          return NextResponse.json(
            { success: false, error: `SKU inválido para variante ${variantId}` },
            { status: 400 }
          )
        }

        if (nextSku !== existing.sku) {
          const { data: duplicateBySku, error: duplicateError } = await supabase
            .from('product_variants')
            .select('id')
            .neq('id', variantId)
            .eq('sku', nextSku)
            .maybeSingle()

          if (duplicateError) {
            logger.error('Failed to validate unique sku on bulk variant update', {
              variantId,
              sku: nextSku,
              error: duplicateError.message,
            })
            throw duplicateError
          }

          if (duplicateBySku) {
            return NextResponse.json(
              { success: false, error: `El SKU ${nextSku} ya existe` },
              { status: 409 }
            )
          }
        }

        patch.sku = nextSku
      }

      if (variantData.name !== undefined) {
        const nextName = String(variantData.name).trim()
        if (!nextName) {
          return NextResponse.json(
            { success: false, error: `Nombre inválido para variante ${variantId}` },
            { status: 400 }
          )
        }
        patch.variant_name = nextName
      }

      if (variantData.stock !== undefined) {
        patch.stock_quantity = Math.max(0, toSafeNumber(variantData.stock, 0))
      }

      if (variantData.active !== undefined) {
        patch.is_active = variantData.active === true
      }

      const baseSalePrice = toSafeNumber(normalizeProductSummary(existing.product)?.sale_price, 0)

      if (variantData.price_adjustment !== undefined) {
        patch.price_adjustment = toSafeNumber(variantData.price_adjustment, 0)
      } else if (variantData.price !== undefined) {
        patch.price_adjustment = toSafeNumber(variantData.price, baseSalePrice) - baseSalePrice
      }

      if (Object.keys(patch).length === 0) continue

      const { data: updated, error: updateError } = await supabase
        .from('product_variants')
        .update(patch)
        .eq('id', variantId)
        .select('*, product:products(sale_price, wholesale_price, purchase_price, min_stock, max_stock)')
        .maybeSingle()

      if (updateError) {
        logger.error('Failed to update variant in bulk', {
          variantId,
          error: updateError.message,
        })
        throw updateError
      }

      if (updated) {
        updatedVariants.push(updated as ProductVariantRow)
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedVariants.map(mapVariantRow),
      message: `${updatedVariants.length} variantes actualizadas`,
    })
  } catch (error) {
    logger.error('Variants PUT API error', { error })
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

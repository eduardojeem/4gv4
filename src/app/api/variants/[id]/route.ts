import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { canViewProductCost } from '@/lib/auth/role-utils'

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
  sale_price?: number | null
  wholesale_price?: number | null
  purchase_price?: number | null
  min_stock?: number | null
  barcode?: string | null
  stock_quantity: number | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
  product?: ProductSummaryRow | ProductSummaryRow[] | null
  attributes?: Record<string, string> | VariantAttributeValue[] | null
}

function toSafeNumber(value: unknown, fallback = 0): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function normalizeAttributeValues(value: unknown): Record<string, string> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key.trim(), String(item).trim()] as const)
        .filter(([key, item]) => key && item),
    )
  }

  if (!Array.isArray(value)) return {}

  return Object.fromEntries(value
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
    .filter((entry) => entry.attribute_name && entry.value)
    .map((entry) => [entry.attribute_name, entry.value]))
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

function mapVariantRow(row: ProductVariantRow, includeCost: boolean) {
  const product = normalizeProductSummary(row.product)
  const basePrice = toSafeNumber(product?.sale_price, 0)
  const baseWholesalePrice = toSafeNumber(product?.wholesale_price, 0)
  const baseCostPrice = toSafeNumber(product?.purchase_price, 0)
  const priceAdjustment = toSafeNumber(row.price_adjustment, 0)

  const price = toSafeNumber(row.sale_price, basePrice + priceAdjustment)
  const wholesalePrice = toSafeNumber(row.wholesale_price, baseWholesalePrice > 0 ? baseWholesalePrice + priceAdjustment : 0) || undefined
  const costPrice = toSafeNumber(row.purchase_price, baseCostPrice) || undefined

  const minStock = toSafeNumber(row.min_stock, toSafeNumber(product?.min_stock, 0))
  const maxStockNumber = toSafeNumber(product?.max_stock, NaN)
  const maxStock = Number.isFinite(maxStockNumber) ? maxStockNumber : undefined

  return {
    id: row.id,
    product_id: row.product_id,
    sku: row.sku ?? '',
    barcode: row.barcode ?? undefined,
    name: row.variant_name ?? row.sku ?? `Variante ${row.id.slice(0, 8)}`,
    attributes: normalizeAttributeValues(row.attributes),
    price,
    wholesale_price: wholesalePrice,
    ...(includeCost ? { cost_price: costPrice } : {}),
    stock: toSafeNumber(row.stock_quantity, 0),
    min_stock: minStock,
    max_stock: maxStock,
    active: row.is_active !== false,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  }
}

// GET /api/variants/[id] - Obtener variante específica
export const GET = withTenantAuth({ permission: 'products.read', module: 'inventory' }, async (
  _request: NextRequest,
  { organization, user },
  routeContext,
) => {
  try {
    const { params } = routeContext as { params: Promise<{ id: string }> }
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('product_variants')
      .select('*, product:products(sale_price, wholesale_price, purchase_price, min_stock, max_stock)')
      .eq('id', id)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (error) {
      logger.error('Failed to fetch variant by id', { variantId: id, error: error.message })
      throw error
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Variante no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: mapVariantRow(data as ProductVariantRow, canViewProductCost(user.role)),
    })
  } catch (error) {
    logger.error('Variants [id] GET API error', { error })
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
})

// PUT /api/variants/[id] - Actualizar variante específica (staff only)
export const PUT = withTenantAuth({ permission: 'products.update', module: 'inventory' }, async (
  request: NextRequest,
  { organization, user },
  routeContext,
) => {
  try {
    const { params } = routeContext as { params: Promise<{ id: string }> }
    const { id } = await params
    const body = await request.json()
    const supabase = await createClient()

    const { data: existing, error: existingError } = await supabase
      .from('product_variants')
      .select('id, sku, product:products(sale_price)')
      .eq('id', id)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (existingError) {
      logger.error('Failed to load variant before update', {
        variantId: id,
        error: existingError.message,
      })
      throw existingError
    }

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Variante no encontrada' },
        { status: 404 }
      )
    }

    const patch: Record<string, unknown> = {}

    if (body.sku !== undefined) {
      const nextSku = String(body.sku).trim()
      if (!nextSku) {
        return NextResponse.json(
          { success: false, error: 'El SKU no puede estar vacío' },
          { status: 400 }
        )
      }

      if (nextSku !== existing.sku) {
        const { data: duplicateBySku, error: duplicateError } = await supabase
          .from('product_variants')
          .select('id')
          .neq('id', id)
          .eq('organization_id', organization.id)
          .eq('sku', nextSku)
          .maybeSingle()

        if (duplicateError) {
          logger.error('Failed to validate unique sku on variant update', {
            variantId: id,
            sku: nextSku,
            error: duplicateError.message,
          })
          throw duplicateError
        }

        if (duplicateBySku) {
          return NextResponse.json(
            { success: false, error: 'El SKU ya existe' },
            { status: 409 }
          )
        }
      }

      patch.sku = nextSku
    }

    if (body.name !== undefined) {
      const nextName = String(body.name).trim()
      if (!nextName) {
        return NextResponse.json(
          { success: false, error: 'El nombre no puede estar vacío' },
          { status: 400 }
        )
      }
      patch.variant_name = nextName
    }

    if (body.stock !== undefined) {
      patch.stock_quantity = Math.max(0, toSafeNumber(body.stock, 0))
    }

    if (body.active !== undefined) {
      patch.is_active = body.active === true
    }

    const baseSalePrice = toSafeNumber(normalizeProductSummary(existing.product)?.sale_price, 0)
    if (body.price_adjustment !== undefined) {
      patch.price_adjustment = toSafeNumber(body.price_adjustment, 0)
    } else if (body.price !== undefined) {
      patch.price_adjustment = toSafeNumber(body.price, baseSalePrice) - baseSalePrice
      patch.sale_price = Math.max(0, toSafeNumber(body.price, baseSalePrice))
    }

    if (body.purchase_price !== undefined || body.cost_price !== undefined) {
      patch.purchase_price = Math.max(0, toSafeNumber(body.purchase_price ?? body.cost_price, 0))
    }
    if (body.wholesale_price !== undefined) {
      patch.wholesale_price = Math.max(0, toSafeNumber(body.wholesale_price, 0))
    }
    if (body.min_stock !== undefined) {
      patch.min_stock = Math.max(0, toSafeNumber(body.min_stock, 0))
    }
    if (body.barcode !== undefined) {
      patch.barcode = String(body.barcode).trim() || null
    }
    if (body.attributes && typeof body.attributes === 'object') {
      patch.attributes = body.attributes
    }

    const { data: updated, error: updateError } = await supabase
      .from('product_variants')
      .update(patch)
      .eq('id', id)
      .eq('organization_id', organization.id)
      .select('*, product:products(sale_price, wholesale_price, purchase_price, min_stock, max_stock)')
      .maybeSingle()

    if (updateError) {
      logger.error('Failed to update variant by id', {
        variantId: id,
        error: updateError.message,
      })
      throw updateError
    }

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Variante no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: mapVariantRow(updated as ProductVariantRow, canViewProductCost(user.role)),
    })
  } catch (error) {
    logger.error('Variants [id] PUT API error', { error })
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
})

// DELETE /api/variants/[id] - Eliminar variante específica (staff only)
export const DELETE = withTenantAuth({ permission: 'products.delete', module: 'inventory' }, async (
  _request: NextRequest,
  { organization, user },
  routeContext,
) => {
  try {
    const { params } = routeContext as { params: Promise<{ id: string }> }
    const { id } = await params
    const supabase = await createClient()

    const { data: existing, error: existingError } = await supabase
      .from('product_variants')
      .select('*, product:products(sale_price, wholesale_price, purchase_price, min_stock, max_stock)')
      .eq('id', id)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (existingError) {
      logger.error('Failed to load variant before delete', {
        variantId: id,
        error: existingError.message,
      })
      throw existingError
    }

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Variante no encontrada' },
        { status: 404 }
      )
    }

    const { error: deleteError } = await supabase
      .from('product_variants')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', organization.id)

    if (deleteError) {
      logger.error('Failed to delete variant by id', {
        variantId: id,
        error: deleteError.message,
      })
      throw deleteError
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Variante desactivada para preservar su historial',
        deleted_variant: mapVariantRow(existing as ProductVariantRow, canViewProductCost(user.role)),
      },
    })
  } catch (error) {
    logger.error('Variants [id] DELETE API error', { error })
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
})

// PATCH /api/variants/[id]/stock - Actualizar solo el stock de una variante (staff only)
export const PATCH = withTenantAuth({ permission: 'products.update', module: 'inventory' }, async (
  request: NextRequest,
  { organization, user },
  routeContext,
) => {
  try {
    const { params } = routeContext as { params: Promise<{ id: string }> }
    const { id } = await params
    const body = await request.json()
    const operation = String(body?.operation || '').trim()
    const stock = toSafeNumber(body?.stock, 0)

    if (!['add', 'subtract', 'set'].includes(operation)) {
      return NextResponse.json(
        { success: false, error: 'Operación no válida. Use: add, subtract, set' },
        { status: 400 }
      )
    }

    if (stock < 0) {
      return NextResponse.json(
        { success: false, error: 'El valor de stock no puede ser negativo' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data: existing, error: existingError } = await supabase
      .from('product_variants')
      .select('stock_quantity')
      .eq('id', id)
      .eq('organization_id', organization.id)
      .maybeSingle()

    if (existingError) {
      logger.error('Failed to load variant stock before patch', {
        variantId: id,
        error: existingError.message,
      })
      throw existingError
    }

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Variante no encontrada' },
        { status: 404 }
      )
    }

    const currentStock = toSafeNumber(existing.stock_quantity, 0)
    let nextStock = currentStock

    if (operation === 'add') {
      nextStock = currentStock + stock
    } else if (operation === 'subtract') {
      nextStock = Math.max(0, currentStock - stock)
    } else if (operation === 'set') {
      nextStock = stock
    }

    const { data: updated, error: updateError } = await supabase
      .from('product_variants')
      .update({ stock_quantity: nextStock })
      .eq('id', id)
      .eq('organization_id', organization.id)
      .select('*, product:products(sale_price, wholesale_price, purchase_price, min_stock, max_stock)')
      .maybeSingle()

    if (updateError) {
      logger.error('Failed to patch variant stock', {
        variantId: id,
        operation,
        error: updateError.message,
      })
      throw updateError
    }

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Variante no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: mapVariantRow(updated as ProductVariantRow, canViewProductCost(user.role)),
    })
  } catch (error) {
    logger.error('Variants [id] PATCH API error', { error })
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
})

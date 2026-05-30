import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { PublicProduct } from '@/types/public'
import { logger } from '@/lib/logger'
import { resolveWholesaleStatus } from '@/lib/api/products-server'
import { resolvePublicOrganization } from '@/lib/saas/public-tenant'

type ProductRow = {
  id: string
  name: string
  sku: string
  description: string | null
  brand: string | null
  sale_price: number
  wholesale_price: number | null
  offer_price: number | null
  has_offer: boolean | null
  stock_quantity: number
  is_active: boolean
  featured: boolean
  image_url: string | null
  images: string[] | null
  unit_measure: string
  barcode: string | null
  category: { id: string; name: string }[] | { id: string; name: string } | null
}

/**
 * GET /api/public/products/[id]
 * Public endpoint - No authentication required
 * Returns detailed product information (safe, public data only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const productId = decodeURIComponent(id)

    const supabase = createAdminSupabase() as SupabaseClient
    const organization = await resolvePublicOrganization(request, supabase)

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      )
    }

    const authSupabase = await createClient()

    const { data: { session } } = await authSupabase.auth.getSession()
    const { isWholesale } = await resolveWholesaleStatus({
      supabase: authSupabase,
      user: session?.user ?? null,
    })

    const selectFields = isWholesale
      ? 'id, name, sku, description, brand, sale_price, wholesale_price, offer_price, has_offer, stock_quantity, is_active, featured, image_url, images, unit_measure, barcode, category:categories(id, name)'
      : 'id, name, sku, description, brand, sale_price, offer_price, has_offer, stock_quantity, is_active, featured, image_url, images, unit_measure, barcode, category:categories(id, name)'

    const productsTable = supabase.from('products') as any

    let byIdQuery = productsTable
      .select(selectFields)
      .eq('id', productId)
      .eq('organization_id', organization.id)
      .eq('is_active', true)

    if (isWholesale) {
      byIdQuery = byIdQuery.in('visibility', ['public', 'wholesale'])
    } else {
      byIdQuery = byIdQuery.eq('visibility', 'public')
    }

    const { data: product, error } = await byIdQuery.maybeSingle()

    if (error) {
      logger.error('Failed to fetch public product', { error: error.message, productId })
      throw error
    }

    // Fallback: try by SKU if UUID lookup returned nothing
    let finalProduct = product as unknown as ProductRow | null
    if (!finalProduct) {
      logger.info('Product UUID lookup returned nothing, trying SKU fallback', { productId })

      let bySkuQuery = productsTable
        .select(selectFields)
        .eq('sku', productId)
        .eq('organization_id', organization.id)
        .eq('is_active', true)

      if (isWholesale) {
        bySkuQuery = bySkuQuery.in('visibility', ['public', 'wholesale'])
      } else {
        bySkuQuery = bySkuQuery.eq('visibility', 'public')
      }

      const { data: bySku, error: skuErr } = await bySkuQuery.maybeSingle()
      if (skuErr) {
        logger.error('Failed SKU lookup for public product', { error: skuErr.message, productId })
      }
      finalProduct = (bySku as unknown as ProductRow) || null
    }

    if (!finalProduct) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // Transform to PublicProduct type
    const category = Array.isArray(finalProduct.category) ? finalProduct.category[0] : finalProduct.category
    const publicProduct: PublicProduct = {
      id: finalProduct.id,
      name: finalProduct.name,
      sku: finalProduct.sku,
      description: finalProduct.description,
      brand: finalProduct.brand,
      category: category ? { id: category.id, name: category.name } : undefined,
      sale_price: finalProduct.sale_price,
      wholesale_price: isWholesale ? finalProduct.wholesale_price : null,
      stock_quantity: finalProduct.stock_quantity,
      in_stock: finalProduct.stock_quantity > 0,
      is_active: finalProduct.is_active,
      featured: finalProduct.featured || false,
      has_offer: Boolean(finalProduct.has_offer),
      offer_price: typeof finalProduct.offer_price === 'number' ? finalProduct.offer_price : null,
      image: finalProduct.image_url || (Array.isArray(finalProduct.images) && finalProduct.images.length > 0 ? finalProduct.images[0] : null),
      images: finalProduct.images,
      unit_measure: finalProduct.unit_measure,
      barcode: finalProduct.barcode,
    }

    return NextResponse.json({
      success: true,
      data: publicProduct,
    })
  } catch (error) {
    logger.error('Public product detail API error', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch product' },
      { status: 500 }
    )
  }
}

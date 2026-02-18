import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PublicProduct } from '@/types/public'
import { logger } from '@/lib/logger'

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

    const supabase = await createClient()

    // Only check wholesale status if user has a session
    let isWholesale = false
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle()
      const role = profile?.role || session.user.user_metadata?.role
      isWholesale = role === 'mayorista' || role === 'client_mayorista'
    }

    // No supplier in public query
    const selectFields = 'id, name, sku, description, brand, sale_price, wholesale_price, stock_quantity, is_active, featured, image_url, images, unit_measure, barcode, category:categories(id, name)'

    const { data: product, error } = await supabase
      .from('products')
      .select(selectFields)
      .eq('id', productId)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      logger.error('Failed to fetch public product', { error: error.message, productId })
      throw error
    }

    // Fallback: try by SKU if UUID lookup returned nothing
    let finalProduct = product
    if (!finalProduct) {
      const { data: bySku, error: skuErr } = await supabase
        .from('products')
        .select(selectFields)
        .eq('sku', productId)
        .eq('is_active', true)
        .maybeSingle()
      if (skuErr) {
        logger.error('Failed SKU lookup for public product', { error: skuErr.message, productId })
      }
      finalProduct = bySku || null
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
      // Only expose stock status, not exact quantity
      stock_quantity: finalProduct.stock_quantity > 0 ? finalProduct.stock_quantity : 0,
      is_active: finalProduct.is_active,
      featured: finalProduct.featured || false,
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

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
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const productId = decodeURIComponent(id)
    
    const supabase = await createClient()
    const { data: authUser } = await supabase.auth.getUser()
    let isWholesale = false
    if (authUser?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authUser.user.id)
        .maybeSingle()
      const role = profile?.role || authUser.user.user_metadata?.role
      isWholesale = role === 'mayorista' || role === 'client_mayorista'
    }
    
    const { data: product, error } = await supabase
      .from('products')
      .select('id, name, sku, description, brand, sale_price, wholesale_price, stock_quantity, is_active, featured, image_url, images, unit_measure, barcode, category:categories(id, name), supplier:suppliers(id, name)')
      .eq('id', productId)
      .eq('is_active', true)  // Only return active products
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
        .select('id, name, sku, description, brand, sale_price, wholesale_price, stock_quantity, is_active, featured, image_url, images, unit_measure, barcode, category:categories(id, name), supplier:suppliers(id, name)')
        .eq('sku', productId)
        .eq('is_active', true)
        .maybeSingle()
      if (skuErr) {
        logger.error('Failed SKU lookup for public product', { error: skuErr.message, productId })
      }
      finalProduct = bySku || null
    }

    if (!finalProduct) {
      logger.warn('Public product not found', { productId })
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }
    
    // Transform to PublicProduct type (filtering sensitive data)
    const category = Array.isArray(finalProduct.category) ? finalProduct.category[0] : finalProduct.category
    const publicProduct: PublicProduct = {
      id: finalProduct.id,
      name: finalProduct.name,
      sku: finalProduct.sku,
      description: finalProduct.description,
      brand: finalProduct.brand,
      category: category ? {
        id: category.id,
        name: category.name
      } : undefined,
      sale_price: isWholesale && finalProduct.wholesale_price != null ? finalProduct.wholesale_price : finalProduct.sale_price,
      stock_quantity: finalProduct.stock_quantity,
      is_active: finalProduct.is_active,
      featured: finalProduct.featured || false,
      image: finalProduct.image_url || (Array.isArray(finalProduct.images) && finalProduct.images.length > 0 ? finalProduct.images[0] : null),
      images: finalProduct.images,
      unit_measure: finalProduct.unit_measure,
      barcode: finalProduct.barcode
    }
    
    return NextResponse.json({
      success: true,
      data: publicProduct
    })
  } catch (error) {
    logger.error('Public product detail API error', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch product' },
      { status: 500 }
    )
  }
}

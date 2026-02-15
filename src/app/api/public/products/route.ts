import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PublicProduct } from '@/types/public'
import { logger } from '@/lib/logger'

/**
 * GET /api/public/products
 * Public endpoint - No authentication required
 * Returns only active products with safe, public data
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const query = searchParams.get('query') || ''
    const categoryId = searchParams.get('category_id')
    const minPrice = parseFloat(searchParams.get('min_price') || '0')
    const maxPrice = parseFloat(searchParams.get('max_price') || '999999')
    const inStock = searchParams.get('in_stock') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = Math.min(parseInt(searchParams.get('per_page') || '20'), 50) // Max 50
    const sort = searchParams.get('sort') || 'name'
    
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
    
    // Build query - only active products
    let queryBuilder = supabase
      .from('products')
      .select('id, name, sku, description, brand, sale_price, wholesale_price, stock_quantity, is_active, featured, image_url, images, unit_measure, barcode, category:categories(id, name)', { count: 'exact' })
      .eq('is_active', true)
    
    // Apply filters
    if (query) {
      queryBuilder = queryBuilder.or(
        `name.ilike.%${query}%,sku.ilike.%${query}%,description.ilike.%${query}%,brand.ilike.%${query}%`
      )
    }
    
    if (categoryId) {
      queryBuilder = queryBuilder.eq('category_id', categoryId)
    }
    
    if (minPrice > 0 || maxPrice < 999999) {
      if (isWholesale) {
        queryBuilder = queryBuilder
          .gte('wholesale_price', minPrice)
          .lte('wholesale_price', maxPrice)
      } else {
        queryBuilder = queryBuilder
          .gte('sale_price', minPrice)
          .lte('sale_price', maxPrice)
      }
    }
    
    if (inStock) {
      queryBuilder = queryBuilder.gt('stock_quantity', 0)
    }
    
    // Apply sorting
    switch (sort) {
      case 'price_asc':
        queryBuilder = queryBuilder.order(isWholesale ? 'wholesale_price' : 'sale_price', { ascending: true })
        break
      case 'price_desc':
        queryBuilder = queryBuilder.order(isWholesale ? 'wholesale_price' : 'sale_price', { ascending: false })
        break
      case 'newest':
        queryBuilder = queryBuilder.order('created_at', { ascending: false })
        break
      default:
        queryBuilder = queryBuilder.order('name', { ascending: true })
    }
    
    // Apply pagination
    const from = (page - 1) * perPage
    const to = from + perPage - 1
    
    const { data: products, error, count } = await queryBuilder.range(from, to)
    
    if (error) {
      logger.error('Failed to fetch public products', { error: error.message })
      throw error
    }
    
    // Transform to PublicProduct type (filtering sensitive data)
    const publicProducts: PublicProduct[] = (products || []).map(p => {
      const category = Array.isArray(p.category) ? p.category[0] : p.category
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        description: p.description,
        brand: p.brand,
        category: category ? {
          id: category.id,
          name: category.name
        } : undefined,
        sale_price: p.sale_price,
        wholesale_price: p.wholesale_price,
        stock_quantity: p.stock_quantity,
        is_active: p.is_active,
        featured: p.featured || false,
        image: p.image_url || (Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null),
        images: p.images,
        unit_measure: p.unit_measure,
        barcode: p.barcode
      }
    })
    
    const response = NextResponse.json({
      success: true,
      data: {
        products: publicProducts,
        total: count || 0,
        page,
        per_page: perPage,
        total_pages: Math.ceil((count || 0) / perPage)
      }
    })
    // Cache control for public data (CDN / browser)
    response.headers.set('Cache-Control', 'public, max-age=30, s-maxage=60')
    return response
  } catch (error) {
    logger.error('Public products API error', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

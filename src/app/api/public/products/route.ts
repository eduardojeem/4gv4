import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PublicProduct } from '@/types/public'
import { logger } from '@/lib/logger'

// Sanitize search input to prevent PostgREST injection
function sanitizeSearch(input: string): string {
  // Remove PostgREST special characters: . , ( ) : ! < > = & | %
  return input.replace(/[.,()!<>=&|%:*\\]/g, '').trim().slice(0, 100)
}

/**
 * GET /api/public/products
 * Public endpoint - No authentication required
 * Returns only active products with safe, public data
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const rawQuery = searchParams.get('query') || ''
    const query = sanitizeSearch(rawQuery)
    const categoryId = searchParams.get('category_id')
    const brand = searchParams.get('brand')
    const minPrice = parseFloat(searchParams.get('min_price') || '0')
    const maxPrice = parseFloat(searchParams.get('max_price') || '999999')
    const inStock = searchParams.get('in_stock') === 'true'
    const hasOffer = searchParams.get('has_offer') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = Math.min(parseInt(searchParams.get('per_page') || '20'), 50)
    const sort = searchParams.get('sort') || 'name'

    const supabase = await createClient()

    // Only check wholesale status if user has a session (skip 2 queries for anonymous)
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

    // Build query - only active products, never select wholesale_price for non-wholesale
    const selectFields = isWholesale
      ? 'id, name, sku, description, brand, sale_price, wholesale_price, offer_price, has_offer, stock_quantity, is_active, featured, image_url, images, unit_measure, barcode, category:categories(id, name)'
      : 'id, name, sku, description, brand, sale_price, offer_price, has_offer, stock_quantity, is_active, featured, image_url, images, unit_measure, barcode, category:categories(id, name)'

    let queryBuilder = supabase
      .from('products')
      .select(selectFields, { count: 'exact' })
      .eq('is_active', true)

    // Apply search filter with sanitized input
    if (query) {
      queryBuilder = queryBuilder.or(
        `name.ilike.%${query}%,sku.ilike.%${query}%,description.ilike.%${query}%,brand.ilike.%${query}%`
      )
    }

    if (categoryId) {
      queryBuilder = queryBuilder.eq('category_id', categoryId)
    }

    if (brand) {
      queryBuilder = queryBuilder.eq('brand', brand)
    }

    if (minPrice > 0 || maxPrice < 999999) {
      const priceCol = isWholesale ? 'wholesale_price' : 'sale_price'
      queryBuilder = queryBuilder.gte(priceCol, minPrice).lte(priceCol, maxPrice)
    }

    if (inStock) {
      queryBuilder = queryBuilder.gt('stock_quantity', 0)
    }

    if (hasOffer) {
      queryBuilder = queryBuilder
        .eq('has_offer', true)
        .gt('offer_price', 0)
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

    // Transform to PublicProduct type - hide sensitive data
    const publicProducts: PublicProduct[] = (products || []).map((p: Record<string, unknown>) => {
      const category = Array.isArray(p.category) ? p.category[0] : p.category
      const cat = category as { id: string; name: string } | null
      return {
        id: p.id as string,
        name: p.name as string,
        sku: p.sku as string,
        description: p.description as string | null,
        brand: p.brand as string | null,
        category: cat ? { id: cat.id, name: cat.name } : undefined,
        sale_price: p.sale_price as number,
        wholesale_price: isWholesale ? (p.wholesale_price as number | null) : null,
        // Only expose stock status, not exact quantity
        stock_quantity: (p.stock_quantity as number) > 0 ? 1 : 0,
        is_active: p.is_active as boolean,
        featured: (p.featured as boolean) || false,
        has_offer: Boolean(p.has_offer),
        offer_price: typeof p.offer_price === 'number' ? (p.offer_price as number) : null,
        image: (p.image_url as string | null) || (Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null),
        images: p.images as string[] | null,
        unit_measure: p.unit_measure as string,
        barcode: p.barcode as string | null,
      }
    })

    const response = NextResponse.json({
      success: true,
      data: {
        products: publicProducts,
        total: count || 0,
        page,
        per_page: perPage,
        total_pages: Math.ceil((count || 0) / perPage),
      },
    })
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

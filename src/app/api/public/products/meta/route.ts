import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * GET /api/public/products/meta
 * Returns metadata for faceted search (brands, price range)
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // Fetch all unique brands and min/max prices from active products
    // We fetch brands separately and price range separately to keep it efficient
    
    // Get brands
    const { data: brandsData, error: brandsError } = await supabase
      .from('products')
      .select('brand')
      .eq('is_active', true)
      .not('brand', 'is', null)

    if (brandsError) throw brandsError

    const brands = Array.from(new Set(brandsData.map(p => p.brand))).sort() as string[]

    // Get price range
    // We select min and max of sale_price
    const { data: priceData, error: priceError } = await supabase
      .from('products')
      .select('sale_price')
      .eq('is_active', true)

    if (priceError) throw priceError

    const prices = priceData.map(p => p.sale_price).filter(p => p > 0)
    const minPrice = prices.length > 0 ? Math.floor(Math.min(...prices) / 5000) * 5000 : 0
    const maxPrice = prices.length > 0 ? Math.ceil(Math.max(...prices) / 5000) * 5000 : 5000000

    const response = NextResponse.json({
      success: true,
      data: {
        brands,
        priceRange: {
          min: minPrice,
          max: maxPrice
        }
      }
    })

    // Cache metadata for 5 minutes
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=600')
    return response
  } catch (error) {
    logger.error('Public products meta API error', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch product metadata' },
      { status: 500 }
    )
  }
}

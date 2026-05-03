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

    // Get price range using min/max — avoids loading all prices into memory
    const { data: minData } = await supabase
      .from('products')
      .select('sale_price')
      .eq('is_active', true)
      .gt('sale_price', 0)
      .order('sale_price', { ascending: true })
      .limit(1)
      .single()

    const { data: maxData } = await supabase
      .from('products')
      .select('sale_price')
      .eq('is_active', true)
      .gt('sale_price', 0)
      .order('sale_price', { ascending: false })
      .limit(1)
      .single()

    const rawMin = minData?.sale_price ?? 0
    const rawMax = maxData?.sale_price ?? 5000000
    const minPrice = Math.floor(rawMin / 5000) * 5000
    const maxPrice = Math.ceil(rawMax / 5000) * 5000

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

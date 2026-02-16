import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * GET /api/public/categories
 * Public endpoint - Returns active categories with product count
 */
export async function GET() {
  try {
    const supabase = await createClient()
    
    // Obtener categorías con conteo de productos activos
    const { data: categories, error } = await supabase
      .from('categories')
      .select('id, name')
      .order('name', { ascending: true })
    
    if (error) {
      logger.error('Failed to fetch public categories', { error: error.message })
      throw error
    }
    
    const response = NextResponse.json({
      success: true,
      data: categories || []
    })
    
    // Cache control para datos públicos
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=600')
    return response
  } catch (error) {
    logger.error('Public categories API error', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}

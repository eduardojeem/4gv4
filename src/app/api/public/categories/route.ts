import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * GET /api/public/categories
 * Public endpoint - Returns active categories with hierarchy (parent/subcategories)
 */
export async function GET() {
  try {
    const supabase = await createClient()
    
    // Obtener todas las categorías con parent_id
    const { data: categories, error } = await supabase
      .from('categories')
      .select('id, name, parent_id')
      .order('name', { ascending: true })
    
    if (error) {
      logger.error('Failed to fetch public categories', { error: error.message })
      throw error
    }
    
    // Organizar categorías en jerarquía
    const categoryMap = new Map(categories?.map(cat => [cat.id, { ...cat, subcategories: [] }]) || [])
    const rootCategories: any[] = []
    
    categoryMap.forEach(category => {
      if (category.parent_id) {
        const parent = categoryMap.get(category.parent_id)
        if (parent) {
          parent.subcategories.push(category)
        } else {
          // Si el padre no existe, tratarla como raíz
          rootCategories.push(category)
        }
      } else {
        rootCategories.push(category)
      }
    })
    
    const response = NextResponse.json({
      success: true,
      data: rootCategories
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

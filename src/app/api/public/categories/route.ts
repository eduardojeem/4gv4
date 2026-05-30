import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { resolvePublicOrganization, toPublicOrganizationPayload } from '@/lib/saas/public-tenant'

type PublicCategoryNode = {
  id: string
  name: string
  parent_id: string | null
  subcategories: PublicCategoryNode[]
}

/**
 * GET /api/public/categories
 * Public endpoint - Returns active categories with hierarchy (parent/subcategories)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminSupabase()
    const organization = await resolvePublicOrganization(request, supabase)

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      )
    }
    
    // Obtener todas las categorías con parent_id
    const { data: categories, error } = await supabase
      .from('categories')
      .select('id, name, parent_id')
      .eq('organization_id', organization.id)
      .order('name', { ascending: true })
    
    if (error) {
      logger.error('Failed to fetch public categories', { error: error.message })
      throw error
    }
    
    // Organizar categorías en jerarquía
    const categoryMap = new Map(
      categories?.map(cat => [
        cat.id,
        { ...cat, subcategories: [] } as PublicCategoryNode,
      ]) || []
    )
    const rootCategories: PublicCategoryNode[] = []
    
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
      data: rootCategories,
      organization: toPublicOrganizationPayload(organization),
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

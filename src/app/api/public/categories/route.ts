import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { resolvePublicStorefrontOrganization, toPublicOrganizationPayload } from '@/lib/saas/public-tenant'

type PublicCategoryNode = {
  id: string
  name: string
  parent_id: string | null
  subcategories: PublicCategoryNode[]
  /** Productos publicados en esta categoría (incluye los de sus subcategorías). */
  productCount: number
}

/**
 * GET /api/public/categories
 * Public endpoint - Returns active categories with hierarchy (parent/subcategories)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminSupabase()
    const organization = await resolvePublicStorefrontOrganization(request, supabase)

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      )
    }
    
    // Categorías + category_id de los productos publicados, en paralelo: el
    // conteo permite ocultar categorías vacías en la vitrina pública.
    const [{ data: categories, error }, { data: productRows }] = await Promise.all([
      supabase
        .from('categories')
        .select('id, name, parent_id')
        .eq('organization_id', organization.id)
        .order('name', { ascending: true }),
      supabase
        .from('products')
        .select('category_id')
        .eq('organization_id', organization.id)
        .eq('is_active', true)
        .eq('visibility', 'public')
        .not('category_id', 'is', null),
    ])

    if (error) {
      logger.error('Failed to fetch public categories', { error: error.message })
      throw error
    }

    // Productos asignados directamente a cada categoría.
    const directCounts = new Map<string, number>()
    for (const row of (productRows ?? []) as Array<{ category_id: string | null }>) {
      if (!row.category_id) continue
      directCounts.set(row.category_id, (directCounts.get(row.category_id) ?? 0) + 1)
    }

    // Organizar categorías en jerarquía
    const categoryMap = new Map(
      categories?.map(cat => [
        cat.id,
        {
          ...cat,
          subcategories: [],
          productCount: directCounts.get(cat.id) ?? 0,
        } as PublicCategoryNode,
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

    // Los padres acumulan los productos de sus subcategorías: filtrar por una
    // categoría padre en el catálogo también incluye a sus hijas.
    for (const root of rootCategories) {
      root.productCount += root.subcategories.reduce((sum, sub) => sum + sub.productCount, 0)
    }

    const response = NextResponse.json({
      success: true,
      data: rootCategories,
      organization: toPublicOrganizationPayload(organization),
    })
    
    // El navegador revalida siempre (respuestas 304 son baratas) mientras la
    // CDN sirve la copia cacheada: así, al publicar productos o categorías, la
    // vitrina se actualiza sin esperar a que expire una caché local de minutos.
    response.headers.set(
      'Cache-Control',
      'no-store'
    )
    return response
  } catch (error) {
    logger.error('Public categories API error', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}

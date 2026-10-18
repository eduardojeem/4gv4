import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { normalizeBrandName, searchGlobalBrands } from '@/lib/brands/global-catalog'
import { logger } from '@/lib/logger'
import { loadCatalog, loadTenantBrands } from '@/lib/brands/catalog.server'

/**
 * GET /api/brands/catalog?search=&limit=
 *
 * Las marcas oficiales que puede elegir una empresa. El catálogo es de la
 * plataforma: acá solo se lee, y el logo sale de esta lista. Cada una dice si
 * ya está en la tienda, para no ofrecer agregarla dos veces.
 *
 * Solo lectura: agregar oficiales a la tienda es POST /api/brands/from-catalog.
 */

export const GET = withTenantAuth({ permission: 'products.read', module: 'inventory' }, async (request, { organization }) => {
  try {
    const params = new URL(request.url).searchParams
    const search = params.get('search')?.trim() ?? ''
    const limit = Math.min(200, Math.max(1, Number(params.get('limit') || 20)))
    const [catalog, tenantBrands] = await Promise.all([loadCatalog(), loadTenantBrands(organization.id)])

    const linkedIds = new Set(tenantBrands.map((brand) => brand.global_brand_id).filter(Boolean) as string[])
    const ownByName = new Map(
      tenantBrands.filter((brand) => !brand.global_brand_id).map((brand) => [normalizeBrandName(brand.name), brand])
    )

    return NextResponse.json({
      success: true,
      data: searchGlobalBrands(search, catalog, limit).map((brand) => ({
        ...brand,
        // Ya vinculada en la tienda: no se puede agregar de nuevo.
        already_added: linkedIds.has(brand.id),
        // La tienda la tiene cargada como propia: agregarla la vincula.
        own_brand_id: ownByName.get(normalizeBrandName(brand.name))?.id ?? null,
      })),
    })
  } catch (error) {
    logger.error('[brands/catalog] GET', { error })
    return NextResponse.json({ success: false, error: 'No se pudo cargar el catálogo de marcas.' }, { status: 500 })
  }
})

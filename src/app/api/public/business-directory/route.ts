import { NextRequest, NextResponse } from 'next/server'
import { getMarketplaceOrganizations } from '@/lib/public/marketplace'
import { BUSINESS_DIRECTORY_MAX_STORES, pageDirectory } from '@/lib/public/business-directory'

/**
 * GET /api/public/business-directory?page=2&rubro=tecnologia&q=encarnacion
 *
 * Una página del directorio de /saas/negocios. Solo tiendas que eligieron
 * publicarse en el marketplace (lo filtra getMarketplaceOrganizations), con la
 * lista en caché del servidor: cambiar de página no vuelve a consultar la base.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  try {
    const stores = await getMarketplaceOrganizations(BUSINESS_DIRECTORY_MAX_STORES)
    const result = pageDirectory(stores, {
      page: Number(params.get('page')) || 1,
      rubro: params.get('rubro'),
      q: params.get('q'),
    })
    return NextResponse.json(
      { success: true, data: result },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
    )
  } catch {
    return NextResponse.json({ success: false, error: 'No se pudo cargar el directorio.' }, { status: 500 })
  }
}

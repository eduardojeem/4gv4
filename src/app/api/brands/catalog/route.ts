import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { searchGlobalBrands, type GlobalBrand } from '@/lib/brands/global-catalog'
import { logger } from '@/lib/logger'

/**
 * GET /api/brands/catalog?search=
 *
 * Las marcas oficiales que puede elegir una empresa. El catálogo es de la
 * plataforma: acá solo se lee, y el logo sale de esta lista.
 */
export const GET = withTenantAuth({ permission: 'products.read', module: 'inventory' }, async (request) => {
  try {
    const search = new URL(request.url).searchParams.get('search')?.trim() ?? ''
    const admin = createAdminSupabase()

    const { data, error } = await admin
      .from('global_brands')
      .select('id, name, slug, aliases, logo_url, website, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(500)

    if (error) throw error

    return NextResponse.json({ success: true, data: searchGlobalBrands(search, (data ?? []) as GlobalBrand[]) })
  } catch (error) {
    logger.error('[brands/catalog] GET', { error })
    return NextResponse.json({ success: false, error: 'No se pudo cargar el catálogo de marcas.' }, { status: 500 })
  }
})

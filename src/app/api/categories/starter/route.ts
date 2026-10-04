import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { STARTER_CATEGORIES, isBusinessVertical, seedStarterCategories } from '@/lib/organization/starter-kit'

export const dynamic = 'force-dynamic'

async function verticalOf(organizationId: string) {
  const { data } = await createAdminSupabase().from('organizations').select('business_vertical').eq('id', organizationId).maybeSingle()
  const vertical = (data as { business_vertical?: string | null } | null)?.business_vertical
  return isBusinessVertical(vertical) ? vertical : 'general'
}

/** Las categorías que se crearían para el rubro de la empresa (para mostrarlas antes). */
export const GET = withTenantAuth({ permission: 'products.read', module: 'inventory' }, async (_request, { organization }) => {
  const vertical = await verticalOf(organization.id)
  return NextResponse.json({ vertical, names: STARTER_CATEGORIES[vertical] })
})

/**
 * Crea las categorías de arranque del rubro. Solo si la empresa no tiene
 * ninguna: nunca duplica ni pisa lo que ya cargó.
 */
export const POST = withTenantAuth({ permission: 'products.create', module: 'inventory' }, async (_request, { organization }) => {
  const admin = createAdminSupabase()
  const vertical = await verticalOf(organization.id)
  try {
    const created = await seedStarterCategories(admin, organization.id, vertical)
    const { data } = await admin
      .from('categories')
      .select('*')
      .eq('organization_id', organization.id)
      .order('name')
    return NextResponse.json({ created, categories: data ?? [] })
  } catch (error) {
    logger.error('No se pudieron crear las categorías del rubro', { error })
    return NextResponse.json({ error: 'No se pudieron crear las categorías' }, { status: 500 })
  }
})

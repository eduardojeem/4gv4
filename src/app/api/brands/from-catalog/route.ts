import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { findGlobalBrandByName, resolveTenantBrandFields } from '@/lib/brands/global-catalog'
import { loadCatalog, loadTenantBrands } from '@/lib/brands/catalog.server'
import { logger } from '@/lib/logger'

/**
 * POST /api/brands/from-catalog  { ids: string[] }
 *
 * Agrega a la tienda varias marcas oficiales de una vez, ya vinculadas: nombre y
 * logo los pone el catálogo. Si la tienda tenía una propia con el mismo nombre,
 * la vincula en lugar de crear otra. El catálogo no se toca.
 */
const addSchema = z.object({ ids: z.array(z.string().uuid()).min(1, 'Elegí al menos una marca.').max(100) })

export const POST = withTenantAuth({ permission: 'products.create', module: 'inventory' }, async (request, { organization }) => {
  try {
    const validation = addSchema.safeParse(await request.json().catch(() => null))
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.issues[0]?.message || 'Datos inválidos.' }, { status: 400 })
    }

    const [catalog, tenantBrands] = await Promise.all([loadCatalog(), loadTenantBrands(organization.id)])
    const byId = new Map(catalog.map((brand) => [brand.id, brand]))
    const linkedIds = new Set(tenantBrands.map((brand) => brand.global_brand_id).filter(Boolean) as string[])
    const supabase = await createClient()
    const now = new Date().toISOString()
    let created = 0
    let linked = 0
    let skipped = 0

    for (const id of validation.data.ids) {
      const official = byId.get(id)
      if (!official || linkedIds.has(id)) {
        skipped += 1
        continue
      }
      const fields = resolveTenantBrandFields({}, official)
      // Una propia con el mismo nombre (o alias) se vincula: no se duplica.
      const own = tenantBrands.find((brand) => !brand.global_brand_id && findGlobalBrandByName(brand.name, [official]))
      const { error } = own
        ? await supabase
            .from('brands')
            .update({ ...fields, updated_at: now })
            .eq('id', own.id)
            .eq('organization_id', organization.id)
            .is('global_brand_id', null)
        : await supabase
            .from('brands')
            .insert({ ...fields, organization_id: organization.id, is_active: true, updated_at: now })
      if (error) {
        skipped += 1
        continue
      }
      linkedIds.add(id)
      if (own) {
        own.global_brand_id = id
        linked += 1
      } else {
        created += 1
      }
    }

    return NextResponse.json({ success: true, created, linked, skipped })
  } catch (error) {
    logger.error('[brands/catalog] POST', { error })
    return NextResponse.json({ success: false, error: 'No se pudieron agregar las marcas.' }, { status: 500 })
  }
})

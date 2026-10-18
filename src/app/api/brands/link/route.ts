import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { resolveTenantBrandFields, suggestBrandLinks, type GlobalBrand } from '@/lib/brands/global-catalog'

export const dynamic = 'force-dynamic'

/**
 * Marcas propias que tienen una oficial con el mismo nombre.
 *
 * Una marca cargada a mano no tiene logo y el marketplace no la agrupa con la
 * oficial. Acá se ofrecen solo las coincidencias exactas (nombre o alias): las
 * parecidas se siguen eligiendo a mano desde la marca.
 */

async function loadExactSuggestions(organizationId: string) {
  const supabase = await createClient()
  const [{ data: tenantBrands, error: brandsError }, { data: catalog, error: catalogError }] = await Promise.all([
    supabase.from('brands').select('id, name, global_brand_id').eq('organization_id', organizationId).is('global_brand_id', null),
    createAdminSupabase()
      .from('global_brands')
      .select('id, name, slug, aliases, logo_url, website, is_active')
      .eq('is_active', true)
      .limit(2000),
  ])
  if (brandsError) throw brandsError
  if (catalogError) throw catalogError

  const byId = new Map(((catalog ?? []) as GlobalBrand[]).map((brand) => [brand.id, brand]))
  const names = new Map((tenantBrands ?? []).map((brand) => [brand.id, brand.name as string]))
  return suggestBrandLinks(tenantBrands ?? [], (catalog ?? []) as GlobalBrand[])
    .filter((suggestion) => suggestion.exact)
    .map((suggestion) => ({
      id: suggestion.id,
      name: names.get(suggestion.id) ?? '',
      official: byId.get(suggestion.global_brand_id) as GlobalBrand,
    }))
    .filter((row) => row.official)
}

export const GET = withTenantAuth({ permission: 'products.read', module: 'inventory' }, async (_request, { organization }) => {
  try {
    const suggestions = await loadExactSuggestions(organization.id)
    return NextResponse.json({
      success: true,
      data: suggestions.map((row) => ({
        id: row.id,
        name: row.name,
        global_brand_id: row.official.id,
        official_name: row.official.name,
        logo_url: row.official.logo_url ?? null,
      })),
    })
  } catch (error) {
    logger.error('[brands/link] GET', { error })
    return NextResponse.json({ success: false, error: 'No se pudieron revisar las marcas.' }, { status: 500 })
  }
})

const linkSchema = z.object({ ids: z.array(z.string().uuid()).max(500).optional() })

export const POST = withTenantAuth({ permission: 'products.update', module: 'inventory' }, async (request, { organization }) => {
  try {
    const validation = linkSchema.safeParse(await request.json().catch(() => ({})))
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Datos inválidos.' }, { status: 400 })
    }

    // Se vuelve a calcular acá: no se vincula nada que el servidor no confirme.
    const wanted = validation.data.ids ? new Set(validation.data.ids) : null
    const suggestions = (await loadExactSuggestions(organization.id)).filter((row) => !wanted || wanted.has(row.id))
    const supabase = await createClient()
    let linked = 0
    let skipped = 0

    for (const row of suggestions) {
      // Nombre y logo los pone el catálogo, como al elegirla desde la marca.
      const official = resolveTenantBrandFields({ name: row.name }, row.official)
      const { error } = await supabase
        .from('brands')
        .update({ ...official, updated_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('organization_id', organization.id)
        .is('global_brand_id', null)
      if (error) {
        // Por ejemplo, otra marca de la empresa ya tiene el nombre oficial.
        skipped += 1
        continue
      }
      linked += 1
    }

    return NextResponse.json({ success: true, linked, skipped })
  } catch (error) {
    logger.error('[brands/link] POST', { error })
    return NextResponse.json({ success: false, error: 'No se pudieron vincular las marcas.' }, { status: 500 })
  }
})

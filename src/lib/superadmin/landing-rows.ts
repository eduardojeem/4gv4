import { createAdminSupabase } from '@/lib/supabase/admin'
import { assessLanding } from '@/lib/superadmin/landing-readiness'
import { templateHeroTitles } from '@/lib/website/template-hero-titles'
import type { LandingRow } from '@/components/superadmin/LandingContentDashboard'

/*
 * Las tiendas con el estado de su landing. Lo usan «Landings de tiendas» y el
 * resumen de «Contenido web», así las dos pantallas cuentan igual: antes el
 * resumen tenía su propia tabla con otro criterio de «completa».
 */

/** Organizaciones consultadas a la vez para contar productos activos. */
const PRODUCTS_BATCH = 10

async function countActiveProducts(admin: ReturnType<typeof createAdminSupabase>, organizationIds: string[]) {
  const counts = new Map<string, number | null>()
  for (let index = 0; index < organizationIds.length; index += PRODUCTS_BATCH) {
    const batch = organizationIds.slice(index, index + PRODUCTS_BATCH)
    const rows = await Promise.all(batch.map(async (organizationId) => {
      const { count, error } = await admin
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('is_active', true)
      // `null`: no se pudo contar. No es lo mismo que una tienda sin productos.
      return [organizationId, error ? null : count ?? 0] as const
    }))
    rows.forEach(([organizationId, count]) => counts.set(organizationId, count))
  }
  return counts
}

export async function getLandingRows(): Promise<{ rows: LandingRow[]; failed: boolean }> {
  const admin = createAdminSupabase()

  const [{ data: orgsData, error: orgsError }, { data: settingsData, error: settingsError }] = await Promise.all([
    admin
      .from('organizations')
      .select('id, name, slug, plan, logo_url, storefront_public, marketplace_public, business_vertical')
      .order('name', { ascending: true })
      .limit(1000),
    admin.from('website_settings').select('organization_id, key, value, updated_at'),
  ])

  if (orgsError || settingsError) return { rows: [], failed: true }

  const orgs = (orgsData ?? []) as Array<{
    id: string
    name: string
    slug: string
    plan: string | null
    logo_url: string | null
    storefront_public: boolean | null
    marketplace_public: boolean | null
    business_vertical: string | null
  }>

  const settingsByOrg = new Map<string, Array<{ key: string; value: unknown; updated_at: string | null }>>()
  for (const row of (settingsData ?? []) as Array<{ organization_id: string | null; key: string; value: unknown; updated_at: string | null }>) {
    if (!row.organization_id) continue
    const current = settingsByOrg.get(row.organization_id) ?? []
    current.push({ key: row.key, value: row.value, updated_at: row.updated_at })
    settingsByOrg.set(row.organization_id, current)
  }

  const products = await countActiveProducts(admin, orgs.map((org) => org.id))
  const templates = templateHeroTitles()

  const rows = orgs.map((org) => {
    const settings = settingsByOrg.get(org.id) ?? []
    const company = settings.find((row) => row.key === 'company_info')?.value as Record<string, unknown> | undefined
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      vertical: org.business_vertical,
      logoUrl: (typeof company?.logoUrl === 'string' && company.logoUrl) || org.logo_url,
      // El color que eligió la tienda para su página, para pintar su tarjeta igual.
      brandColor: typeof company?.brandColor === 'string' ? company.brandColor : null,
      customBrandColor: typeof company?.customBrandColor === 'string' ? company.customBrandColor : null,
      marketplacePublic: org.marketplace_public === true,
      activeProducts: products.get(org.id) ?? null,
      assessment: assessLanding({
        storefrontPublic: org.storefront_public,
        organizationLogoUrl: org.logo_url,
        activeProducts: products.get(org.id) ?? null,
        settings,
        templateHeroTitles: templates,
      }),
    }
  })

  return { rows, failed: false }
}

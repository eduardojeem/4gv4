import { createAdminSupabase } from '@/lib/supabase/admin'
import { WebContentOverview, type WebContentData } from '@/components/superadmin/WebContentOverview'

async function getWebContentData(): Promise<WebContentData> {
  const admin = createAdminSupabase()

  const [{ data: orgsData }, { data: settingsData }] = await Promise.all([
    admin.from('organizations').select('id, name, slug, plan, marketplace_public, created_at'),
    admin.from('website_settings').select('organization_id, key, value, updated_at, updated_by'),
  ])

  const orgs = (orgsData ?? []) as Array<{
    id: string; name: string; slug: string; plan: string | null
    marketplace_public: boolean | null; created_at: string | null
  }>
  const settings = (settingsData ?? []) as Array<{
    organization_id: string | null; key: string; value: unknown
    updated_at: string | null; updated_by: string | null
  }>

  // Group settings by org
  const settingsByOrg = new Map<string, Map<string, { value: unknown; updated_at: string | null }>>()
  settings.forEach((s) => {
    if (!s.organization_id) return
    const m = settingsByOrg.get(s.organization_id) ?? new Map()
    m.set(s.key, { value: s.value, updated_at: s.updated_at })
    settingsByOrg.set(s.organization_id, m)
  })

  // Per-org status
  const orgStatuses = orgs.map((o) => {
    const orgSettings = settingsByOrg.get(o.id) ?? new Map()
    const companyInfo = orgSettings.get('company_info')?.value as Record<string, unknown> | undefined
    const heroContent = orgSettings.get('hero_content')?.value as Record<string, unknown> | undefined
    const maintenance = orgSettings.get('maintenance_mode')?.value as Record<string, unknown> | undefined
    const services = orgSettings.get('services')?.value as unknown[] | undefined
    const testimonials = orgSettings.get('testimonials')?.value as unknown[] | undefined

    // Calcular completitud
    const checks = {
      hasLogo:        Boolean(companyInfo?.logoUrl),
      hasPhone:       Boolean(companyInfo?.phone),
      hasEmail:       Boolean(companyInfo?.email),
      hasAddress:     Boolean(companyInfo?.address),
      hasHero:        Boolean(heroContent?.title),
      hasServices:    Array.isArray(services) && services.length > 0,
      hasTestimonials: Array.isArray(testimonials) && testimonials.length > 0,
    }
    const completed = Object.values(checks).filter(Boolean).length
    const totalChecks = Object.keys(checks).length
    const completion = Math.round((completed / totalChecks) * 100)

    // Last updated
    let lastUpdated: string | null = null
    orgSettings.forEach((s) => {
      if (s.updated_at && (!lastUpdated || s.updated_at > lastUpdated)) {
        lastUpdated = s.updated_at
      }
    })

    return {
      id: o.id,
      name: o.name,
      slug: o.slug,
      plan: o.plan ?? 'FREE',
      marketplacePublic: o.marketplace_public !== false,
      maintenanceMode: Boolean(maintenance?.enabled),
      completion,
      settingsCount: orgSettings.size,
      lastUpdated,
      checks,
    }
  })

  // Summary stats
  const fullyConfigured = orgStatuses.filter((o) => o.completion >= 80).length
  const inMaintenance = orgStatuses.filter((o) => o.maintenanceMode).length
  const marketplacePublic = orgStatuses.filter((o) => o.marketplacePublic).length
  const noLogo = orgStatuses.filter((o) => !o.checks.hasLogo).length
  const avgCompletion = orgStatuses.length
    ? Math.round(orgStatuses.reduce((sum, o) => sum + o.completion, 0) / orgStatuses.length)
    : 0

  return {
    orgs: orgStatuses,
    summary: {
      total: orgStatuses.length,
      fullyConfigured,
      inMaintenance,
      marketplacePublic,
      noLogo,
      avgCompletion,
    },
    fetchedAt: new Date().toISOString(),
  }
}

export default async function SuperAdminWebContentPage() {
  const data = await getWebContentData()
  return <WebContentOverview data={data} />
}

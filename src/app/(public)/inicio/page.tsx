import type { Metadata } from 'next'
import { fetchWebsiteSettings } from '@/lib/website/fetch-settings'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { getPublicBranchLocations } from '@/lib/api/products-server'
import { normalizeBusinessProfile } from '@/lib/organization/business-profile'
import { getOrganizationPlanInfo } from '@/lib/saas/subscription-service'
import { resolveRequestStorefrontOrganization } from '@/lib/website/request-storefront-organization'
import { resolveStorefrontCapabilities } from '@/lib/website/storefront-capabilities'
import HomePageClient from './HomePageClient'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchWebsiteSettings()
  const company = settings?.company_info
  const hero = settings?.hero_content

  const name = company?.name || 'Tienda'
  const title = hero?.title || 'Tienda online'
  const description = hero?.subtitle || 'Productos y servicios con atención personalizada.'

  return {
    title: `${name} — ${title}`,
    description,
    openGraph: {
      title: `${name} — ${title}`,
      description,
      type: 'website',
    },
  }
}

export default async function HomePage() {
  const [settings, branches, organization] = await Promise.all([
    fetchWebsiteSettings(),
    getPublicBranchLocations(),
    resolveRequestStorefrontOrganization(),
  ])

  // Even if the DB fetch fails, render with defaults so the page is never blank
  const safeSettings = settings ?? getWebsiteSettingsDefaults()
  const fallbackProfile = normalizeBusinessProfile({
    businessVertical: organization?.business_vertical,
    operatingModel: 'retail',
    enabledModules: [],
  })
  const profile = organization
    ? await getOrganizationPlanInfo(organization.id).catch(() => null)
    : null
  const capabilities = resolveStorefrontCapabilities({
    businessVertical: profile?.businessVertical ?? fallbackProfile.businessVertical,
    operatingModel: profile?.operatingModel ?? fallbackProfile.operatingModel,
    // Ante un fallo no habilitamos servicios o reparaciones por una preferencia
    // guardada: es más seguro ocultar temporalmente que prometer algo inexistente.
    effectiveModules: profile?.effectiveModules ?? [],
  })

  return <HomePageClient initialSettings={safeSettings} branches={branches} capabilities={capabilities} />
}

import type { Metadata } from 'next'
import { fetchWebsiteSettings } from '@/lib/website/fetch-settings'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { getPublicBranchLocations } from '@/lib/api/products-server'
import HomePageClient from './HomePageClient'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchWebsiteSettings()
  const company = settings?.company_info
  const hero = settings?.hero_content

  const name = company?.name || '4G Celulares'
  const title = hero?.title || 'Reparación y venta de tecnología'
  const description = hero?.subtitle || 'Servicio técnico profesional con garantía. Venta de accesorios y repuestos.'

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
  const [settings, branches] = await Promise.all([
    fetchWebsiteSettings(),
    getPublicBranchLocations(),
  ])

  // Even if the DB fetch fails, render with defaults so the page is never blank
  const safeSettings = settings ?? getWebsiteSettingsDefaults()

  return <HomePageClient initialSettings={safeSettings} branches={branches} />
}

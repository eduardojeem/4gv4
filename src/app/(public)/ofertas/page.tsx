import type { Metadata } from 'next'
import { OffersPageClient } from './OffersPageClient'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { fetchWebsiteSettings } from '@/lib/website/fetch-settings'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchWebsiteSettings()
  const companyName = settings?.company_info?.name || 'Tienda'

  return {
    title: `Ofertas | ${companyName}`,
    description: `Descubrí productos seleccionados con precios especiales en ${companyName}.`,
  }
}

export default async function OffersPage() {
  const settings = await fetchWebsiteSettings()

  return <OffersPageClient initialSettings={settings ?? getWebsiteSettingsDefaults()} />
}

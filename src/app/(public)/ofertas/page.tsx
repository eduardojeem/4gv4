import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { OffersPageClient } from './OffersPageClient'
import { getWebsiteSettingsDefaults } from '@/lib/website/default-settings'
import { fetchWebsiteSettings } from '@/lib/website/fetch-settings'
import { getTenantSlugFromHost } from '@/lib/saas/tenant'
import { getStorefrontOffers } from '@/lib/public/marketplace'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchWebsiteSettings()
  const companyName = settings?.company_info?.name || 'Tienda'

  return {
    title: `Ofertas | ${companyName}`,
    description: `Descubrí productos seleccionados con precios especiales en ${companyName}.`,
  }
}

export default async function OffersPage() {
  const headerStore = await headers()
  const tenantSlug =
    headerStore.get('x-tenant-slug') ||
    getTenantSlugFromHost(headerStore.get('host') ?? '')

  const settings = await fetchWebsiteSettings()
  const initialOffers = await getStorefrontOffers(tenantSlug)

  // Mapear al tipo OfferProduct requerido por el cliente
  const mappedOffers = initialOffers.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    description: p.description,
    sale_price: p.sale_price,
    offer_price: p.offer_price ?? 0,
    has_offer: p.has_offer,
    in_stock: p.in_stock,
    stock_quantity: p.stock_quantity,
    featured: p.featured,
    image: p.image,
    images: p.images,
    category: p.category ? { id: p.category.id, name: p.category.name } : undefined,
    created_at: p.created_at ?? null,
  }))

  return (
    <OffersPageClient
      initialSettings={settings ?? getWebsiteSettingsDefaults()}
      initialOffers={mappedOffers}
    />
  )
}

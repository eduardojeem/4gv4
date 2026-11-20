'use client'

import { BarberHeader } from '@/components/public/barber/BarberHeader'
import { PublicHeader } from '@/components/public/PublicHeader'
import { ModaFemeninaHeader } from '@/components/public/moda-femenina/ModaFemeninaHeader'
import { StoreMobileBottomNav } from '@/components/public/StoreMobileBottomNav'
import { ServicesSiteHeader } from '@/components/public/services/ServicesSiteHeader'
import { ServicesMobileNav } from '@/components/public/services/ServicesMobileNav'
import { useStorefrontStyle } from '@/components/public/storefront-style-context'
import type { WebsiteSettings } from '@/types/website-settings'
import { useWebsiteSettings } from '@/hooks/useWebsiteSettings'
import useSWR from 'swr'
import { fetchPublicProducts, NEWEST_PRODUCTS_SWR_OPTIONS } from '@/components/public/inicio/newest-products'
import { techOffersKey, hasTechOffer } from '@/lib/website/mega-tech-publication'
import { usePathname } from 'next/navigation'
import { getTenantSlugFromPathname } from '@/lib/saas/tenant'
import { useHydrated } from '@/hooks/use-hydrated'

/**
 * Encabezado y barra inferior de la tienda. La plantilla «Servicios» es un
 * sitio de peluquería o barbería, no una tienda: tiene los suyos. Se decide
 * en el cliente porque la vista previa del editor cambia la plantilla en vivo.
 */
export function StorefrontHeader({
  initialSettings = null,
  repairsModuleEnabled,
  servicesModuleEnabled,
  catalogEnabled = true,
}: {
  initialSettings?: WebsiteSettings | null
  repairsModuleEnabled?: boolean
  servicesModuleEnabled?: boolean
  catalogEnabled?: boolean
}) {
  const style = useStorefrontStyle()
  if (style === 'barber') return <BarberHeader settings={initialSettings} catalogEnabled={catalogEnabled} />
  if (style === 'services') return <ServicesSiteHeader initialSettings={initialSettings} catalogEnabled={catalogEnabled} />
  if (style === 'moda-femenina') return <ModaFemeninaHeader settings={initialSettings} catalogEnabled={catalogEnabled} />
  return (
    <PublicHeader
      initialSettings={initialSettings}
      repairsModuleEnabled={repairsModuleEnabled}
      servicesModuleEnabled={servicesModuleEnabled}
      catalogEnabled={catalogEnabled}
    />
  )
}

export function StorefrontMobileNav({
  initialSettings = null,
  offersEnabled,
  catalogEnabled = true,
}: {
  initialSettings?: WebsiteSettings | null
  offersEnabled?: boolean
  catalogEnabled?: boolean
}) {
  const style = useStorefrontStyle()
  const { settings: liveSettings } = useWebsiteSettings()
  const settings = liveSettings ?? initialSettings
  const hydrated = useHydrated()
  const slug = getTenantSlugFromPathname(usePathname())
  const tech = style === 'informatica-electronica'
  const offersAllowed = catalogEnabled && settings?.offers_section?.enabled !== false
  const { data: offers } = useSWR(tech && offersAllowed ? techOffersKey(slug) : null, fetchPublicProducts, NEWEST_PRODUCTS_SWR_OPTIONS)
  if (style === 'services' || style === 'barber') return <ServicesMobileNav initialSettings={initialSettings} />
  return <StoreMobileBottomNav offersEnabled={tech ? hydrated && offersAllowed && Boolean(offers?.some(hasTechOffer)) : offersEnabled} catalogEnabled={tech ? catalogEnabled : true} cartEnabled={tech ? catalogEnabled && settings?.checkout?.commerceMode === 'cart' : true} />
}

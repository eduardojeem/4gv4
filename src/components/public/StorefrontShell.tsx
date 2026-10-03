'use client'

import { PublicHeader } from '@/components/public/PublicHeader'
import { StoreMobileBottomNav } from '@/components/public/StoreMobileBottomNav'
import { ServicesSiteHeader } from '@/components/public/services/ServicesSiteHeader'
import { ServicesMobileNav } from '@/components/public/services/ServicesMobileNav'
import { useStorefrontStyle } from '@/components/public/storefront-style-context'
import type { WebsiteSettings } from '@/types/website-settings'

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
  if (style === 'services') return <ServicesSiteHeader initialSettings={initialSettings} catalogEnabled={catalogEnabled} />
  return (
    <PublicHeader
      initialSettings={initialSettings}
      repairsModuleEnabled={repairsModuleEnabled}
      servicesModuleEnabled={servicesModuleEnabled}
    />
  )
}

export function StorefrontMobileNav({
  initialSettings = null,
  offersEnabled,
}: {
  initialSettings?: WebsiteSettings | null
  offersEnabled?: boolean
}) {
  const style = useStorefrontStyle()
  if (style === 'services') return <ServicesMobileNav initialSettings={initialSettings} />
  return <StoreMobileBottomNav offersEnabled={offersEnabled} />
}

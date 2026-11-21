import { brandPaletteStyle, isBrandPalette } from '@/lib/website/brand-palette'
import { Metadata } from 'next'
import { StorefrontHeader, StorefrontMobileNav } from '@/components/public/StorefrontShell'
import { PublicFooter } from '@/components/public/PublicFooter'
import { MaintenanceGuard } from '@/components/public/MaintenanceGuard'
import { SkipToContentLink } from '@/components/ui/skip-link'
import { WhatsAppFloatButton } from '@/components/whatsapp-float-button'
import { fetchWebsiteSettings } from '@/lib/website/fetch-settings'
import { CartProviderWithDrawer } from '@/components/public/cart/CartProviderWithDrawer'
import { StorefrontStyleProvider } from '@/components/public/storefront-style-context'
import { DEFAULT_SYSTEM_COLOR_SCHEME } from '@/lib/theme/color-schemes'
import { AnnouncementModal } from '@/components/public/AnnouncementModal'
import { SiteAnalyticsTracker } from '@/components/analytics/SiteAnalyticsTracker'
import {
  MAX_STORE_ANNOUNCEMENTS,
  normalizeAnnouncementList,
  pickLiveAnnouncement,
} from '@/lib/announcements/announcement'
import { isOrganizationModuleEnabled } from '@/lib/saas/organization-module-check'
import { resolveRequestStorefrontOrganization } from '@/lib/website/request-storefront-organization'
import { resolveStorefrontStyle } from '@/lib/website/storefront-style'
import { verticalOffersRepairs } from '@/lib/website/storefront-capabilities'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchWebsiteSettings()
  const company = settings?.company_info
  const name = company?.name || 'Tienda'
  const description = 'Reparación profesional de celulares con garantía. Venta de accesorios y repuestos originales.'

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
    title: {
      default: `${name} - Reparación y Venta de Celulares`,
      template: `%s | ${name}`
    },
    description,
    applicationName: name,
    openGraph: {
      siteName: name,
      type: 'website',
      description,
    },
    icons: {
      icon: '/favicon.ico',
      apple: '/apple-touch-icon.png'
    }
  }
}

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [settings, storefrontOrganization] = await Promise.all([
    fetchWebsiteSettings(),
    resolveRequestStorefrontOrganization(),
  ])
  const brandColor = settings?.company_info?.brandColor || 'blue'
  const customBrandColor = settings?.company_info?.customBrandColor
  // Este layout tambien sirve tiendas (por subdominio). Sin modulo de taller no
  // ofrecen seguimiento de reparaciones; sin tienda resuelta queda como estaba.
  const repairsModuleEnabled = storefrontOrganization
    ? verticalOffersRepairs(storefrontOrganization.business_vertical)
      && await isOrganizationModuleEnabled(storefrontOrganization.id, 'repairs')
    : true
  const catalogEnabled = storefrontOrganization
    ? await isOrganizationModuleEnabled(storefrontOrganization.id, 'inventory')
    : true
  // «Servicios» necesita la agenda: sin el módulo, la tienda usa la plantilla de su rubro.
  const servicesModuleEnabled = storefrontOrganization
    ? await isOrganizationModuleEnabled(storefrontOrganization.id, 'services')
    : true
  // El aspecto que eligio el dueño o, en «Automático», el de su rubro.
  const storefrontStyle = resolveStorefrontStyle(settings?.company_info?.storefrontStyle, storefrontOrganization?.business_vertical, {
    servicesAvailable: servicesModuleEnabled,
    catalogAvailable: catalogEnabled,
    commerceMode: settings?.checkout?.commerceMode,
  })

  return (
    <MaintenanceGuard initialSettings={settings}>
      <StorefrontStyleProvider style={storefrontStyle}>
        <CartProviderWithDrawer>
          <div 
            className="flex min-h-screen flex-col" 
            // Siempre con esquema propio: con color «custom» va el base y encima
            // el de la marca. Sin atributo, la tienda heredaba la paleta del panel.
            data-color-scheme={brandColor === 'custom' ? DEFAULT_SYSTEM_COLOR_SCHEME : brandColor}
            // Ver nota en [organizationSlug]/layout.tsx: --brand-primary lo
            // resuelve globals.css con ajuste automático para modo oscuro.
            data-custom-brand={brandColor === 'custom' && customBrandColor ? '' : undefined}
            style={{ ...(brandColor === 'custom' && customBrandColor ? { '--brand-primary': customBrandColor } : {}), ...brandPaletteStyle(settings?.company_info?.brandPalette) } as React.CSSProperties}
            data-storefront-palette={isBrandPalette(settings?.company_info?.brandPalette) ? '' : undefined}
            data-storefront-style={storefrontStyle}
          >
            <SkipToContentLink />
          <AnnouncementModal
            announcement={pickLiveAnnouncement(
              normalizeAnnouncementList(settings?.announcements ?? settings?.announcement, MAX_STORE_ANNOUNCEMENTS),
              new Date(),
            )}
            scope={`tienda:${storefrontOrganization?.slug ?? settings?.company_info?.slug ?? 'tienda'}`}
          />
            <StorefrontHeader initialSettings={settings} catalogEnabled={catalogEnabled} repairsModuleEnabled={repairsModuleEnabled} servicesModuleEnabled={servicesModuleEnabled} />
            <div className="flex-1 pb-16 lg:pb-0">{children}</div>
            <PublicFooter initialSettings={settings} repairsModuleEnabled={repairsModuleEnabled} servicesModuleEnabled={servicesModuleEnabled} catalogEnabled={catalogEnabled} />
            <StorefrontMobileNav initialSettings={settings} catalogEnabled={catalogEnabled} />
            <WhatsAppFloatButton />
            {storefrontOrganization && <SiteAnalyticsTracker tenantSlug={storefrontOrganization.slug} />}
          </div>
        </CartProviderWithDrawer>
      </StorefrontStyleProvider>
    </MaintenanceGuard>
  )
}

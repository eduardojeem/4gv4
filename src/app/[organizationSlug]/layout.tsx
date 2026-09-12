import type { Metadata } from 'next'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { MaintenanceGuard } from '@/components/public/MaintenanceGuard'
import { SkipToContentLink } from '@/components/ui/skip-link'
import { WhatsAppFloatButton } from '@/components/whatsapp-float-button'
import { CartProviderWithDrawer } from '@/components/public/cart/CartProviderWithDrawer'
import { CustomerLinkBanner } from '@/components/public/CustomerLinkBanner'
import { StoreMobileBottomNav } from '@/components/public/StoreMobileBottomNav'
import { fetchWebsiteSettings } from '@/lib/website/fetch-settings'
import { resolvePublicStorefrontOrganizationBySlug } from '@/lib/saas/public-tenant'
import { isOrganizationModuleEnabled } from '@/lib/saas/organization-module-check'
import { resolveStorefrontStyle } from '@/lib/website/storefront-style'
import { StorefrontStyleProvider } from '@/components/public/storefront-style-context'
import { notFound } from 'next/navigation'

// Cada tienda declara su propio manifest, para que el icono instalado abra en
// esa tienda y no en la raiz de la plataforma.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ organizationSlug: string }>
}): Promise<Metadata> {
  const { organizationSlug } = await params
  return { manifest: `/${organizationSlug}/manifest.webmanifest` }
}

export default async function OrganizationPublicLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ organizationSlug: string }>
}) {
  const { organizationSlug } = await params
  const storefrontOrganization = await resolvePublicStorefrontOrganizationBySlug(organizationSlug)
  if (!storefrontOrganization) notFound()
  // Sin modulo de taller la tienda no ofrece seguimiento de reparaciones.
  const repairsModuleEnabled = await isOrganizationModuleEnabled(storefrontOrganization.id, 'repairs')
  const servicesModuleEnabled = await isOrganizationModuleEnabled(storefrontOrganization.id, 'services')
  const settings = await fetchWebsiteSettings()
  if (settings?.company_info) {
    if (!servicesModuleEnabled) {
      settings.company_info.servicesPageEnabled = false
    }
    if (!repairsModuleEnabled) {
      settings.company_info.repairTrackingEnabled = false
    }
  }
  const brandColor = settings?.company_info?.brandColor || 'blue'
  const customBrandColor = settings?.company_info?.customBrandColor
  // El aspecto que eligio el dueño o, en «Automático», el de su rubro.
  const storefrontStyle = resolveStorefrontStyle(settings?.company_info?.storefrontStyle, storefrontOrganization.business_vertical)

  return (
    <MaintenanceGuard initialSettings={settings}>
      <StorefrontStyleProvider style={storefrontStyle}>
        <CartProviderWithDrawer>
          <div 
            className="flex min-h-screen flex-col" 
            data-color-scheme={brandColor === 'custom' ? undefined : brandColor}
            data-custom-brand={brandColor === 'custom' && customBrandColor ? '' : undefined}
            style={brandColor === 'custom' && customBrandColor ? { '--brand-primary': customBrandColor } as React.CSSProperties : undefined}
            data-storefront-style={storefrontStyle}
          >
            <SkipToContentLink />
            <PublicHeader
              initialSettings={settings}
              repairsModuleEnabled={repairsModuleEnabled}
              servicesModuleEnabled={servicesModuleEnabled}
            />
            <CustomerLinkBanner />
            <div className="flex-1 pb-16 lg:pb-0">{children}</div>
            <PublicFooter initialSettings={settings} repairsModuleEnabled={repairsModuleEnabled} />
            <StoreMobileBottomNav />
            <WhatsAppFloatButton />
          </div>
        </CartProviderWithDrawer>
      </StorefrontStyleProvider>
    </MaintenanceGuard>
  )
}

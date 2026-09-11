import { Metadata } from 'next'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { MaintenanceGuard } from '@/components/public/MaintenanceGuard'
import { SkipToContentLink } from '@/components/ui/skip-link'
import { WhatsAppFloatButton } from '@/components/whatsapp-float-button'
import { fetchWebsiteSettings } from '@/lib/website/fetch-settings'
import { CartProviderWithDrawer } from '@/components/public/cart/CartProviderWithDrawer'
import { StoreMobileBottomNav } from '@/components/public/StoreMobileBottomNav'
import { StorefrontStyleProvider } from '@/components/public/storefront-style-context'
import { isOrganizationModuleEnabled } from '@/lib/saas/organization-module-check'
import { resolveRequestStorefrontOrganization } from '@/lib/website/request-storefront-organization'
import { resolveStorefrontStyle } from '@/lib/website/storefront-style'

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
    ? await isOrganizationModuleEnabled(storefrontOrganization.id, 'repairs')
    : true
  // El aspecto que eligio el dueño o, en «Automático», el de su rubro.
  const storefrontStyle = resolveStorefrontStyle(settings?.company_info?.storefrontStyle, storefrontOrganization?.business_vertical)

  return (
    <MaintenanceGuard initialSettings={settings}>
      <StorefrontStyleProvider style={storefrontStyle}>
        <CartProviderWithDrawer>
          <div 
            className="flex min-h-screen flex-col" 
            data-color-scheme={brandColor === 'custom' ? undefined : brandColor}
            // Ver nota en [organizationSlug]/layout.tsx: --brand-primary lo
            // resuelve globals.css con ajuste automático para modo oscuro.
            data-custom-brand={brandColor === 'custom' && customBrandColor ? '' : undefined}
            style={brandColor === 'custom' && customBrandColor ? { '--brand-primary': customBrandColor } as React.CSSProperties : undefined}
            data-storefront-style={storefrontStyle}
          >
            <SkipToContentLink />
            <PublicHeader initialSettings={settings} />
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

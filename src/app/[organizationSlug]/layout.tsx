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
}: {
  children: React.ReactNode
}) {
  const settings = await fetchWebsiteSettings()
  const brandColor = settings?.company_info?.brandColor || 'blue'
  const customBrandColor = settings?.company_info?.customBrandColor

  return (
    <MaintenanceGuard initialSettings={settings}>
      <CartProviderWithDrawer>
        <div 
          className="flex min-h-screen flex-col" 
          data-color-scheme={brandColor === 'custom' ? undefined : brandColor}
          data-custom-brand={brandColor === 'custom' && customBrandColor ? '' : undefined}
          style={brandColor === 'custom' && customBrandColor ? { '--brand-primary': customBrandColor } as React.CSSProperties : undefined}
        >
          <SkipToContentLink />
          <PublicHeader initialSettings={settings} />
          <CustomerLinkBanner />
          <div className="flex-1 pb-16 lg:pb-0">{children}</div>
          <PublicFooter initialSettings={settings} />
          <StoreMobileBottomNav />
          <WhatsAppFloatButton />
        </div>
      </CartProviderWithDrawer>
    </MaintenanceGuard>
  )
}

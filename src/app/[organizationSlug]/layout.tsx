import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { MaintenanceGuard } from '@/components/public/MaintenanceGuard'
import { SkipToContentLink } from '@/components/ui/skip-link'
import { WhatsAppFloatButton } from '@/components/whatsapp-float-button'
import { CartProviderWithDrawer } from '@/components/public/cart/CartProviderWithDrawer'
import { fetchWebsiteSettings } from '@/lib/website/fetch-settings'

export default async function OrganizationPublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const settings = await fetchWebsiteSettings()
  const brandColor = settings?.company_info?.brandColor || 'blue'
  const customBrandColor = settings?.company_info?.customBrandColor

  return (
    <MaintenanceGuard>
      <CartProviderWithDrawer>
        <div 
          className="flex min-h-screen flex-col" 
          data-color-scheme={brandColor === 'custom' ? undefined : brandColor}
          style={brandColor === 'custom' && customBrandColor ? { '--primary': customBrandColor } as React.CSSProperties : undefined}
        >
          <SkipToContentLink />
          <PublicHeader />
          <main id="main-content" className="flex-1">{children}</main>
          <PublicFooter />
          <WhatsAppFloatButton />
        </div>
      </CartProviderWithDrawer>
    </MaintenanceGuard>
  )
}

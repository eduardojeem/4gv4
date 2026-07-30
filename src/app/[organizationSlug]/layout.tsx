import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { MaintenanceGuard } from '@/components/public/MaintenanceGuard'
import { SkipToContentLink } from '@/components/ui/skip-link'
import { WhatsAppFloatButton } from '@/components/whatsapp-float-button'
import { CartProviderWithDrawer } from '@/components/public/cart/CartProviderWithDrawer'
import { CustomerLinkBanner } from '@/components/public/CustomerLinkBanner'
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
    <MaintenanceGuard initialSettings={settings}>
      <CartProviderWithDrawer>
        <div 
          className="flex min-h-screen flex-col" 
          data-color-scheme={brandColor === 'custom' ? undefined : brandColor}
          // El color de marca se expone como --brand-primary (no como --primary
          // directo): globals.css lo mapea y, en modo oscuro, lo aclara. Antes
          // una marca casi negra quedaba ilegible sobre fondo oscuro.
          data-custom-brand={brandColor === 'custom' && customBrandColor ? '' : undefined}
          style={brandColor === 'custom' && customBrandColor ? { '--brand-primary': customBrandColor } as React.CSSProperties : undefined}
        >
          <SkipToContentLink />
          <PublicHeader initialSettings={settings} />
          <CustomerLinkBanner />
          <div className="flex-1">{children}</div>
          <PublicFooter initialSettings={settings} />
          <WhatsAppFloatButton />
        </div>
      </CartProviderWithDrawer>
    </MaintenanceGuard>
  )
}

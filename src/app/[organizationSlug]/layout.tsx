import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { MaintenanceGuard } from '@/components/public/MaintenanceGuard'
import { SkipToContentLink } from '@/components/ui/skip-link'
import { WhatsAppFloatButton } from '@/components/whatsapp-float-button'
import { CartProviderWithDrawer } from '@/components/public/cart/CartProviderWithDrawer'

export default function OrganizationPublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <MaintenanceGuard>
      <CartProviderWithDrawer>
        <div className="flex min-h-screen flex-col">
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

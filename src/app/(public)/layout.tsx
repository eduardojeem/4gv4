import { Metadata } from 'next'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { MaintenanceGuard } from '@/components/public/MaintenanceGuard'
import { SkipToContentLink } from '@/components/ui/skip-link'
import { WhatsAppFloatButton } from '@/components/whatsapp-float-button'
import { fetchWebsiteSettings } from '@/lib/website/fetch-settings'
import { CartProviderWithDrawer } from '@/components/public/cart/CartProviderWithDrawer'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchWebsiteSettings()
  const company = settings?.company_info
  const name = company?.name || '4G Celulares'
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
  const settings = await fetchWebsiteSettings()
  const brandColor = settings?.company_info?.brandColor || 'blue'

  return (
    <MaintenanceGuard>
      <CartProviderWithDrawer>
        <div className="flex min-h-screen flex-col" data-color-scheme={brandColor}>
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

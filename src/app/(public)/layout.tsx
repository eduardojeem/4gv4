import { Metadata } from 'next'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { MaintenanceGuard } from '@/components/public/MaintenanceGuard'
import { SkipToContentLink } from '@/components/ui/skip-link'
import { WhatsAppFloatButton } from '@/components/whatsapp-float-button'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
  title: {
    default: '4G Celulares - Reparación y Venta de Celulares',
    template: '%s | 4G Celulares'
  },
  description: 'Reparación profesional de celulares con garantía. Venta de accesorios y repuestos originales.',
  applicationName: '4G Celulares',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png'
  }
}

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <MaintenanceGuard>
      <div className="flex min-h-screen flex-col">
        <SkipToContentLink />
        <PublicHeader />
        <main id="main-content" className="flex-1">{children}</main>
        <PublicFooter />
        <WhatsAppFloatButton />
      </div>
    </MaintenanceGuard>
  )
}

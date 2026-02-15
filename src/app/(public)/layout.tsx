import { Metadata } from 'next'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { RecaptchaProvider } from '@/components/public/RecaptchaProvider'

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
    <RecaptchaProvider>
      <div className="flex min-h-screen flex-col">
        <PublicHeader />
        <main className="flex-1">{children}</main>
        <PublicFooter />
      </div>
    </RecaptchaProvider>
  )
}

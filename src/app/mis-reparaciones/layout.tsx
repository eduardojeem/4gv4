import { Metadata } from 'next'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { RecaptchaProvider } from '@/components/public/RecaptchaProvider'
import { MaintenanceGuard } from '@/components/public/MaintenanceGuard'

export const metadata: Metadata = {
  title: 'Mis Reparaciones | 4G Celulares',
  description: 'Rastrea el estado de tu reparación en tiempo real.',
}

export default function MisReparacionesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RecaptchaProvider>
      <MaintenanceGuard>
        <div className="flex min-h-screen flex-col">
          <PublicHeader />
          <main className="flex-1">{children}</main>
          <PublicFooter />
        </div>
      </MaintenanceGuard>
    </RecaptchaProvider>
  )
}

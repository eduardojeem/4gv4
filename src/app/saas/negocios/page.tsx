import type { Metadata } from 'next'
import { SaaSPublicNav } from '@/components/public/saas-public-nav'
import { SaaSBusinessPageContent } from '@/components/saas/landing/saas-business-page-content'
import { SaaSCTASection } from '@/components/saas/landing/saas-cta-section'
import { getPlatformBranding } from '@/lib/platform/branding'

export const metadata: Metadata = {
  title: 'Soluciones por tipo de negocio: tiendas, servicios técnicos y delivery',
  description: 'Plataforma multiempresa para POS, inventario, reparaciones, catálogo público, pedidos y delivery. Adaptada al flujo real de cada negocio.',
}

export default async function SaaSBusinessPage() {
  const branding = await getPlatformBranding()

  return (
    <div className="min-h-screen bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <SaaSPublicNav />

      <main>
        <SaaSBusinessPageContent />
        <SaaSCTASection branding={branding} />
      </main>
    </div>
  )
}

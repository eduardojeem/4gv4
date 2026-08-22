import type { Metadata } from 'next'
import { SaaSPublicNav } from '@/components/public/saas-public-nav'
import { SaaSBusinessPageContent } from '@/components/saas/landing/saas-business-page-content'
import { SaaSCTASection } from '@/components/saas/landing/saas-cta-section'
import { getPlatformBranding } from '@/lib/platform/branding'

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPlatformBranding()
  return {
    title: `Soluciones por Tipo de Negocio | ${branding.platformName}`,
    description: 'Plataforma multiempresa para POS, inventario físico y de servicios, reparaciones técnicas, catálogo público y delivery.',
  }
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

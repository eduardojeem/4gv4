import type { Metadata } from 'next'
import { publicPageMetadata } from '@/lib/seo/page-metadata'
import { SaaSPublicNav } from '@/components/public/saas-public-nav'
import { SaaSSolutionsPageContent } from '@/components/saas/landing/saas-solutions-page-content'
import { SaaSCTASection } from '@/components/saas/landing/saas-cta-section'
import { getPlatformBranding } from '@/lib/platform/branding'

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPlatformBranding()
  return publicPageMetadata({
    title: `Soluciones del Sistema SaaS | ${branding.platformName}`,
    description: 'Conocé herramientas de ventas, inventario, servicios, reservas y reparaciones para mercados, tiendas de ropa, barberías y otros negocios.',
    path: '/saas/soluciones',
  })
}

export default async function SaaSSolutionsPage() {
  const branding = await getPlatformBranding()

  return (
    <div className="min-h-screen bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <SaaSPublicNav />

      <main id="contenido-principal">
        <SaaSSolutionsPageContent />
        <SaaSCTASection branding={branding} />
      </main>
    </div>
  )
}

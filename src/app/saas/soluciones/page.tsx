import type { Metadata } from 'next'
import { SaaSPublicNav } from '@/components/public/saas-public-nav'
import { SaaSSolutionsPageContent } from '@/components/saas/landing/saas-solutions-page-content'
import { SaaSCTASection } from '@/components/saas/landing/saas-cta-section'
import { getPlatformBranding } from '@/lib/platform/branding'

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPlatformBranding()
  return {
    title: `Soluciones del Sistema SaaS | ${branding.platformName}`,
    description: 'Descubrí cómo nuestro software resuelve los problemas reales de tu taller técnico, punto de venta, control de inventario y caja sin diferencias.',
  }
}

export default async function SaaSSolutionsPage() {
  const branding = await getPlatformBranding()

  return (
    <div className="min-h-screen bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <SaaSPublicNav />

      <main>
        <SaaSSolutionsPageContent />
        <SaaSCTASection branding={branding} />
      </main>
    </div>
  )
}

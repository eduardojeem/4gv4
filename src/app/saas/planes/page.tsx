import type { Metadata } from 'next'
import { publicPageMetadata } from '@/lib/seo/page-metadata'
import { SaaSPublicNav } from '@/components/public/saas-public-nav'
import { SaaSCTASection } from '@/components/saas/landing/saas-cta-section'
import { SaaSPlansSection } from '@/components/saas/landing/saas-plans-section'
import { getPlatformBranding } from '@/lib/platform/branding'
import { getPublicSubscriptionPlans } from '@/lib/saas/public-plans'

export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPlatformBranding()
  return publicPageMetadata({
    title: `Planes y Precios | ${branding.platformName}`,
    description: 'Compará los planes activos para operar POS, inventario físico y de servicios, reparaciones y marketplace.',
    path: '/saas/planes',
  })
}

export default async function SaaSPlansPage() {
  const [plans, branding] = await Promise.all([
    getPublicSubscriptionPlans(),
    getPlatformBranding(),
  ])

  return (
    <div className="min-h-screen bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <SaaSPublicNav />

      <main>
        <SaaSPlansSection initialPlans={plans} headingLevel="h1" />
        <SaaSCTASection branding={branding} />
      </main>
    </div>
  )
}

import type { Metadata } from 'next'
import { publicPageMetadata } from '@/lib/seo/page-metadata'
import { SaaSPublicNav } from '@/components/public/saas-public-nav'
import { SaaSBusinessSection } from '@/components/saas/landing/saas-business-section'
import { SaaSCTASection } from '@/components/saas/landing/saas-cta-section'
import { SaaSFeaturesSection } from '@/components/saas/landing/saas-features-section'
import { SaaSHeroSection } from '@/components/saas/landing/saas-hero-section'
import { SaaSPlansSection } from '@/components/saas/landing/saas-plans-section'
import { getPlatformBranding } from '@/lib/platform/branding'
import { getPublicSubscriptionPlans } from '@/lib/saas/public-plans'

export const revalidate = 300

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPlatformBranding()
  return publicPageMetadata({
    title: branding.seoTitle,
    description: branding.seoDescription,
    path: '/saas',
  })
}

export default async function SaaSLandingPage() {
  const [plans, branding] = await Promise.all([
    getPublicSubscriptionPlans(),
    getPlatformBranding(),
  ])

  return (
    <div className="min-h-screen bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <SaaSPublicNav />

      <main id="contenido-principal">
        <SaaSHeroSection branding={branding} />
        <SaaSFeaturesSection />
        <SaaSBusinessSection />
        <SaaSPlansSection initialPlans={plans} />
        <SaaSCTASection branding={branding} />
      </main>
    </div>
  )
}

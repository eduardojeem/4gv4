import type { Metadata } from 'next'
import { SaaSPublicNav } from '@/components/public/saas-public-nav'
import { SaaSBusinessSection } from '@/components/saas/landing/saas-business-section'
import { SaaSCTASection } from '@/components/saas/landing/saas-cta-section'
import { SaaSFeaturesSection } from '@/components/saas/landing/saas-features-section'
import { SaaSHeroSection } from '@/components/saas/landing/saas-hero-section'
import { SaaSPlansSection } from '@/components/saas/landing/saas-plans-section'
import { createClient } from '@/lib/supabase/server'
import { getPlatformBranding } from '@/lib/platform/branding'

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPlatformBranding()
  return {
    title: branding.seoTitle,
    description: branding.seoDescription,
  }
}

export default async function SaaSLandingPage() {
  const [supabase, branding] = await Promise.all([
    createClient(),
    getPlatformBranding(),
  ])
  
  // Obtenemos los planes desde la DB, solo los activos, ordenados por precio
  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('price', { ascending: true })

  return (
    <div className="min-h-screen bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <SaaSPublicNav />

      <main>
        <SaaSHeroSection branding={branding} />
        <SaaSFeaturesSection />
        <SaaSBusinessSection />
        <SaaSPlansSection initialPlans={plans || []} />
        <SaaSCTASection branding={branding} />
      </main>
    </div>
  )
}

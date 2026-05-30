import type { Metadata } from 'next'
import { SaaSPublicNav } from '@/components/public/saas-public-nav'
import { SaaSBusinessSection } from '@/components/saas/landing/saas-business-section'
import { SaaSCTASection } from '@/components/saas/landing/saas-cta-section'
import { SaaSFeaturesSection } from '@/components/saas/landing/saas-features-section'
import { SaaSHeroSection } from '@/components/saas/landing/saas-hero-section'
import { SaaSPlansSection } from '@/components/saas/landing/saas-plans-section'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'MiPOS SaaS para tiendas, service y marketplace',
  description: 'Sistema SaaS multiempresa para POS, inventario, ecommerce, reparaciones, delivery y marketplace.',
}

export default async function SaaSLandingPage() {
  const supabase = await createClient()
  
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
        <SaaSHeroSection />
        <SaaSFeaturesSection />
        <SaaSBusinessSection />
        <SaaSPlansSection initialPlans={plans || []} />
        <SaaSCTASection />
      </main>
    </div>
  )
}

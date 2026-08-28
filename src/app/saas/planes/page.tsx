import type { Metadata } from 'next'
import { SaaSPublicNav } from '@/components/public/saas-public-nav'
import { SaaSCTASection } from '@/components/saas/landing/saas-cta-section'
import { SaaSPlansSection } from '@/components/saas/landing/saas-plans-section'
import { createClient } from '@/lib/supabase/server'
import { getPlatformBranding } from '@/lib/platform/branding'

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPlatformBranding()
  return {
    title: `Planes y Precios | ${branding.platformName}`,
    description: 'Compará los planes activos para operar POS, inventario físico y de servicios, reparaciones y marketplace.',
  }
}

export default async function SaaSPlansPage() {
  const [supabase, branding] = await Promise.all([
    createClient(),
    getPlatformBranding(),
  ])
  
  // Obtenemos los planes desde la DB, solo los activos, ordenados por precio
  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('id, tier, name, price, price_note, description, is_popular, is_active, limits, highlights, features, color_config')
    .eq('is_active', true)
    .order('price', { ascending: true })

  return (
    <div className="min-h-screen bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <SaaSPublicNav />

      <main>
        <SaaSPlansSection initialPlans={plans || []} />
        <SaaSCTASection branding={branding} />
      </main>
    </div>
  )
}

import type { Metadata } from 'next'
import { SaaSPublicNav } from '@/components/public/saas-public-nav'
import { SaaSCTASection } from '@/components/saas/landing/saas-cta-section'
import { SaaSPlansSection } from '@/components/saas/landing/saas-plans-section'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Planes | MiPOS SaaS',
  description: 'Planes FREE, BASIC, PRO y ENTERPRISE para operar POS, inventario, reparaciones y marketplace.',
}

export default async function SaaSPlansPage() {
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
        <SaaSPlansSection initialPlans={plans || []} />
        <SaaSCTASection />
      </main>
    </div>
  )
}

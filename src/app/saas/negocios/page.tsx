import type { Metadata } from 'next'
import { SaaSPublicNav } from '@/components/public/saas-public-nav'
import { SaaSBusinessPageContent } from '@/components/saas/landing/saas-business-page-content'
import { SaaSCTASection } from '@/components/saas/landing/saas-cta-section'

export const metadata: Metadata = {
  title: 'Negocios SaaS para tiendas, service y delivery | MiPOS',
  description: 'Soluciones SaaS por tipo de negocio: POS para tiendas, reparaciones para servicios tecnicos, multi-sucursal, ecommerce, pedidos y delivery.',
}

export default function SaaSBusinessPage() {
  return (
    <div className="min-h-screen bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <SaaSPublicNav />

      <main>
        <SaaSBusinessPageContent />
        <SaaSCTASection />
      </main>
    </div>
  )
}

import type { Metadata } from 'next'
import { OrganizationModuleGate } from '@/components/admin/OrganizationModuleGate'
import { QuoteEditor } from '@/components/dashboard/quotes/QuoteEditor'

export const metadata: Metadata = { title: 'Nuevo presupuesto | Dashboard' }

export default function NewQuotePage() {
  return (
    <OrganizationModuleGate module="pos" title="Presupuestos no incluidos" description="Presupuestos que se mandan por WhatsApp y se convierten en venta.">
      <QuoteEditor />
    </OrganizationModuleGate>
  )
}

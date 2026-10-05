import type { Metadata } from 'next'
import { OrganizationModuleGate } from '@/components/admin/OrganizationModuleGate'
import { QuoteEditor } from '@/components/dashboard/quotes/QuoteEditor'

export const metadata: Metadata = { title: 'Presupuesto | Dashboard' }

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <OrganizationModuleGate module="pos" title="Presupuestos no incluidos" description="Presupuestos que se mandan por WhatsApp y se convierten en venta.">
      <QuoteEditor key={id} quoteId={id} />
    </OrganizationModuleGate>
  )
}

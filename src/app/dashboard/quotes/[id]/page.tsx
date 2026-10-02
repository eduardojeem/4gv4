import type { Metadata } from 'next'
import { PlanGate } from '@/components/admin/PlanGate'
import { QuoteEditor } from '@/components/dashboard/quotes/QuoteEditor'

export const metadata: Metadata = { title: 'Presupuesto | Dashboard' }

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <PlanGate module="pos" title="Presupuestos no incluidos" description="Presupuestos que se mandan por WhatsApp y se convierten en venta.">
      <QuoteEditor key={id} quoteId={id} />
    </PlanGate>
  )
}

import type { Metadata } from 'next'
import { PlanGate } from '@/components/admin/PlanGate'
import { QuotesList } from '@/components/dashboard/quotes/QuotesList'

export const metadata: Metadata = { title: 'Presupuestos | Dashboard' }

export default function QuotesPage() {
  return (
    <PlanGate module="pos" title="Presupuestos no incluidos" description="Presupuestos que se mandan por WhatsApp y se convierten en venta.">
      <QuotesList />
    </PlanGate>
  )
}

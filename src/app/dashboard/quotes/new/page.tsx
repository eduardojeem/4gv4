import type { Metadata } from 'next'
import { PlanGate } from '@/components/admin/PlanGate'
import { QuoteEditor } from '@/components/dashboard/quotes/QuoteEditor'

export const metadata: Metadata = { title: 'Nuevo presupuesto | Dashboard' }

export default function NewQuotePage() {
  return (
    <PlanGate module="pos" title="Presupuestos no incluidos" description="Presupuestos que se mandan por WhatsApp y se convierten en venta.">
      <QuoteEditor />
    </PlanGate>
  )
}

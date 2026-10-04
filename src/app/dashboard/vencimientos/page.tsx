import type { Metadata } from 'next'
import { PlanGate } from '@/components/admin/PlanGate'
import { ExpirationsBoard } from '@/components/dashboard/expirations/ExpirationsBoard'

export const metadata: Metadata = { title: 'Vencimientos | Dashboard' }

export default function ExpirationsPage() {
  return (
    <PlanGate module="inventory" title="Vencimientos no incluidos" description="Lotes vencidos o por vencer, para sacarlos a tiempo del estante.">
      <ExpirationsBoard />
    </PlanGate>
  )
}

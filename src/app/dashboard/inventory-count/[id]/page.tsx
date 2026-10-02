import type { Metadata } from 'next'
import { PlanGate } from '@/components/admin/PlanGate'
import { InventoryCountSheet } from '@/components/dashboard/inventory-count/InventoryCountSheet'

export const metadata: Metadata = { title: 'Toma de inventario | Dashboard' }

export default async function InventoryCountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <PlanGate module="inventory" title="Toma de inventario no incluida" description="Contar el stock físico, ver diferencias y ajustar con registro.">
      <InventoryCountSheet key={id} countId={id} />
    </PlanGate>
  )
}

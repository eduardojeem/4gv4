import type { Metadata } from 'next'
import { PlanGate } from '@/components/admin/PlanGate'
import { InventoryCountsList } from '@/components/dashboard/inventory-count/InventoryCountsList'

export const metadata: Metadata = { title: 'Toma de inventario | Dashboard' }

export default function InventoryCountPage() {
  return (
    <PlanGate module="inventory" title="Toma de inventario no incluida" description="Contar el stock físico, ver diferencias y ajustar con registro.">
      <InventoryCountsList />
    </PlanGate>
  )
}

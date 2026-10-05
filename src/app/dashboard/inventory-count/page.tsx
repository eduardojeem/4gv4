import type { Metadata } from 'next'
import { OrganizationModuleGate } from '@/components/admin/OrganizationModuleGate'
import { InventoryCountsList } from '@/components/dashboard/inventory-count/InventoryCountsList'

export const metadata: Metadata = { title: 'Toma de inventario | Dashboard' }

export default function InventoryCountPage() {
  return (
    <OrganizationModuleGate module="inventory" title="Toma de inventario no incluida" description="Contar el stock físico, ver diferencias y ajustar con registro.">
      <InventoryCountsList />
    </OrganizationModuleGate>
  )
}

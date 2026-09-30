import { Suspense } from 'react'
import InventoryManagement from '@/components/admin/inventory/inventory-management'
import { PlanGate } from '@/components/admin/PlanGate'

export default function InventoryPage() {
    return (
        <div className="space-y-6">
            <PlanGate
                module="inventory_admin"
                title="Inventario avanzado no incluido"
                description="Proveedores, stock por sucursal, movimientos, variantes y reportes de inventario."
            >
                <Suspense fallback={<div className="p-4">Cargando inventario...</div>}>
                    <InventoryManagement />
                </Suspense>
            </PlanGate>
        </div>
    )
}

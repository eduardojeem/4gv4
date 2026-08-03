import { Suspense } from 'react'
import InventoryManagement from '@/components/admin/inventory/inventory-management'
import { PlanGate } from '@/components/admin/PlanGate'

export default function InventoryPage() {
    return (
        <div className="space-y-6">
            <PlanGate
                module="inventory_admin"
                requiredPlan="Basic"
                title="Inventario avanzado no incluido"
                description="Esta sección incluye proveedores, stock por sucursal, movimientos, variantes, promociones y reportes. Activa Inventario avanzado en el plan o sube a Basic para usarla."
            >
                <Suspense fallback={<div className="p-4">Cargando inventario...</div>}>
                    <InventoryManagement />
                </Suspense>
            </PlanGate>
        </div>
    )
}

import { Suspense } from 'react'
import InventoryManagement from '@/components/admin/inventory/inventory-management'
import { OrganizationModuleGate } from '@/components/admin/OrganizationModuleGate'

export default function InventoryPage() {
    return (
        <div className="space-y-6">
            <OrganizationModuleGate
                module="inventory_admin"
                title="Inventario avanzado no incluido"
                description="Proveedores, stock por sucursal, movimientos, variantes y reportes de inventario."
            >
                <Suspense fallback={<div className="p-4">Cargando inventario...</div>}>
                    <InventoryManagement />
                </Suspense>
            </OrganizationModuleGate>
        </div>
    )
}

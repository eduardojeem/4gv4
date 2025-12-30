import { Suspense } from 'react'
import InventoryManagement from '@/components/admin/inventory/inventory-management'

export default function InventoryPage() {
    return (
        <div className="space-y-6">
            <Suspense fallback={<div className="p-4">Cargando inventario...</div>}>
                <InventoryManagement />
            </Suspense>
        </div>
    )
}

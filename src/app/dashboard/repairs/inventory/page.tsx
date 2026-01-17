/**
 * Página de Inventario y Servicios - Versión Optimizada
 * 
 * Mejoras implementadas:
 * - Componentes modulares (de 700+ líneas a ~50)
 * - Context API para estado centralizado
 * - Memoización para mejor rendimiento
 * - Skeleton loaders para mejor UX
 * - Código más mantenible y escalable
 */

"use client"

import { Suspense } from 'react'
import { InventoryProvider } from './context/InventoryContext'
import { InventoryHeader } from './components/InventoryHeader'
import { InventoryStats } from './components/InventoryStats'
import { InventoryTabs } from './components/InventoryTabs'
import { InventorySkeleton } from './components/InventorySkeleton'

export default function InventoryPage() {
  return (
    <InventoryProvider>
      <div className="space-y-6 p-6 pb-20">
        <InventoryHeader />
        
        <Suspense fallback={<InventorySkeleton />}>
          <InventoryStats />
        </Suspense>
        
        <InventoryTabs />
      </div>
    </InventoryProvider>
  )
}

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
      <div className="space-y-4 p-4 md:p-6 pb-20 max-w-7xl mx-auto w-full relative animate-in fade-in duration-500">
        {/* Background decoration */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none" />

        <InventoryHeader />

        <Suspense fallback={<InventorySkeleton />}>
          <InventoryStats />
        </Suspense>
        
        <InventoryTabs />
      </div>
    </InventoryProvider>
  )
}

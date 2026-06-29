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
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Info } from 'lucide-react'

export default function InventoryPage() {
  return (
    <InventoryProvider>
      <div className="space-y-6 p-6 pb-20 max-w-7xl mx-auto w-full relative animate-in fade-in duration-500">
        {/* Background decoration */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none" />

        <InventoryHeader />

        {/* Guía de funcionamiento de repuestos y servicios */}
        <Card className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-blue-100/50 dark:border-blue-950/20 backdrop-blur-md">
          <details className="group">
            <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden flex items-center justify-between p-5 pb-3">
              <div className="text-md font-bold flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <Info className="h-4.5 w-4.5" /> ¿Cómo funciona la sección de Repuestos y Servicios?
              </div>
              <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 select-none">
                <span className="group-open:hidden flex items-center gap-1">Mostrar guía ↓</span>
                <span className="hidden group-open:flex items-center gap-1">Ocultar guía ↑</span>
              </div>
            </summary>
            <CardContent className="pt-0 pb-5 text-xs">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5 p-3.5 rounded-xl bg-background/60 border border-border/40 backdrop-blur-sm">
                  <h4 className="font-semibold text-foreground flex items-center gap-1.5">
                    <Badge variant="secondary" className="h-4.5 w-4.5 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">1</Badge>
                    Stock de Repuestos
                  </h4>
                  <p className="text-muted-foreground leading-relaxed">
                    Administra el stock físico de repuestos específicos del taller (ej: módulos, baterías, pines de carga). Al registrarse en una reparación, el stock se descuenta automáticamente.
                  </p>
                </div>
                <div className="space-y-1.5 p-3.5 rounded-xl bg-background/60 border border-border/40 backdrop-blur-sm">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <Badge variant="secondary" className="h-4.5 w-4.5 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">2</Badge>
                    Servicios y Mano de Obra
                  </h4>
                  <p className="text-muted-foreground leading-relaxed">
                    Define servicios estandarizados con precios sugeridos (ej: "Limpieza Química", "Soldadura Reballing"). Esto agiliza la cotización que el técnico realiza al cliente.
                  </p>
                </div>
                <div className="space-y-1.5 p-3.5 rounded-xl bg-background/60 border border-border/40 backdrop-blur-sm">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <Badge variant="secondary" className="h-4.5 w-4.5 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">3</Badge>
                    Historial de Movimientos
                  </h4>
                  <p className="text-muted-foreground leading-relaxed">
                    Registra y audita todas las entradas (compras de insumos) y salidas (uso en orden de soporte o mermas) con motivos específicos para mantener la cuadratura del inventario.
                  </p>
                </div>
              </div>
            </CardContent>
          </details>
        </Card>
        
        <Suspense fallback={<InventorySkeleton />}>
          <InventoryStats />
        </Suspense>
        
        <InventoryTabs />
      </div>
    </InventoryProvider>
  )
}

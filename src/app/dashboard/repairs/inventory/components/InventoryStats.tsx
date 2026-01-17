"use client"

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, Wrench, AlertTriangle } from 'lucide-react'
import { useInventory } from '../context/InventoryContext'

export function InventoryStats() {
  const { inventory, services } = useInventory()

  const stats = useMemo(() => {
    const totalValue = inventory.reduce(
      (acc, p) => acc + ((p.stock_quantity || 0) * (p.purchase_price || 0)), 
      0
    )
    
    const lowStockCount = inventory.filter(
      p => (p.stock_quantity || 0) <= (p.min_stock || 5)
    ).length

    return {
      totalValue,
      productCount: inventory.length,
      serviceCount: services.length,
      lowStockCount
    }
  }, [inventory, services])

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Card 1: Valor del Inventario - Azul */}
      <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">
            Valor del Inventario
          </CardTitle>
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            ${stats.totalValue.toFixed(2)}
          </div>
          <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">
            {stats.productCount} productos físicos
          </p>
        </CardContent>
      </Card>

      {/* Card 2: Servicios Activos - Verde */}
      <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-green-900 dark:text-green-100">
            Servicios Activos
          </CardTitle>
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <Wrench className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-700 dark:text-green-300">
            {stats.serviceCount}
          </div>
          <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">
            Catálogo de reparaciones
          </p>
        </CardContent>
      </Card>

      {/* Card 3: Alertas de Stock - Naranja/Ámbar */}
      <Card className="border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-background">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Alertas de Stock
          </CardTitle>
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
            {stats.lowStockCount}
          </div>
          <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">
            Productos con stock bajo
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, Wrench, AlertTriangle } from 'lucide-react'
import { useInventory } from '../context/InventoryContext'
import { formatPrice } from '@/lib/utils'

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
      <Card className="relative overflow-hidden bg-background/50 backdrop-blur-xl border border-border/50 shadow-sm hover:shadow-md transition-all duration-300 group">
        <div className="absolute inset-0 opacity-[0.03] bg-gradient-to-br from-blue-400 to-indigo-600 group-hover:opacity-10 transition-opacity duration-300" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            Valor del Inventario
          </CardTitle>
          <div className="p-2 bg-gradient-to-br from-blue-400/20 to-indigo-600/20 rounded-xl group-hover:scale-110 transition-transform duration-300">
            <Package className="h-4 w-4 text-blue-500" />
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-2xl font-black tracking-tight text-foreground">
            {formatPrice(stats.totalValue)}
          </div>
          <p className="text-xs font-medium text-muted-foreground mt-1">
            {stats.productCount} productos físicos
          </p>
        </CardContent>
      </Card>

      {/* Card 2: Servicios Activos - Verde */}
      <Card className="relative overflow-hidden bg-background/50 backdrop-blur-xl border border-border/50 shadow-sm hover:shadow-md transition-all duration-300 group">
        <div className="absolute inset-0 opacity-[0.03] bg-gradient-to-br from-emerald-400 to-teal-600 group-hover:opacity-10 transition-opacity duration-300" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            Servicios Activos
          </CardTitle>
          <div className="p-2 bg-gradient-to-br from-emerald-400/20 to-teal-600/20 rounded-xl group-hover:scale-110 transition-transform duration-300">
            <Wrench className="h-4 w-4 text-emerald-500" />
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-2xl font-black tracking-tight text-foreground">
            {stats.serviceCount}
          </div>
          <p className="text-xs font-medium text-muted-foreground mt-1">
            Catálogo de reparaciones
          </p>
        </CardContent>
      </Card>

      {/* Card 3: Alertas de Stock - Naranja/Ámbar */}
      <Card className="relative overflow-hidden bg-background/50 backdrop-blur-xl border border-border/50 shadow-sm hover:shadow-md transition-all duration-300 group">
        <div className="absolute inset-0 opacity-[0.03] bg-gradient-to-br from-amber-400 to-orange-600 group-hover:opacity-10 transition-opacity duration-300" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            Alertas de Stock
          </CardTitle>
          <div className="p-2 bg-gradient-to-br from-amber-400/20 to-orange-600/20 rounded-xl group-hover:scale-110 transition-transform duration-300">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-2xl font-black tracking-tight text-foreground">
            {stats.lowStockCount}
          </div>
          <p className="text-xs font-medium text-muted-foreground mt-1">
            Productos con stock bajo
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

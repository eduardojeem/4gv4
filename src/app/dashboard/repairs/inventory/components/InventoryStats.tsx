"use client"

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, Wrench, AlertTriangle, ShieldAlert, DollarSign, Layers } from 'lucide-react'
import { useInventory } from '../context/InventoryContext'
import { formatPrice } from '@/lib/utils'

export function InventoryStats() {
  const { inventory, services } = useInventory()

  const stats = useMemo(() => {
    // Valor total a precio de costo
    const totalCostValue = inventory.reduce(
      (acc, p) => acc + ((p.stock_quantity || 0) * (p.purchase_price || 0)),
      0
    )

    // Valor proyectado a precio de venta
    const totalSaleValue = inventory.reduce(
      (acc, p) => acc + ((p.stock_quantity || 0) * (p.sale_price || 0)),
      0
    )

    // Unidades físicas totales acumuladas en stock
    const totalPhysicalUnits = inventory.reduce(
      (acc, p) => acc + (p.stock_quantity || 0),
      0
    )

    // Alertas de stock bajo
    const lowStockCount = inventory.filter(
      p => (p.stock_quantity || 0) <= (p.min_stock || 5) && (p.stock_quantity || 0) > 0
    ).length

    // Repuestos agotados (0 unidades)
    const outOfStockCount = inventory.filter(
      p => (p.stock_quantity || 0) === 0
    ).length

    // Repuestos con stock normal (óptimo)
    const inStockCount = inventory.filter(
      p => (p.stock_quantity || 0) > (p.min_stock || 5)
    ).length

    // Margen de ganancia promedio de servicios
    const avgServicePrice = services.length > 0
      ? services.reduce((acc, s) => acc + (s.sale_price || 0), 0) / services.length
      : 0

    return {
      totalCostValue,
      totalSaleValue,
      totalPhysicalUnits,
      productCount: inventory.length,
      serviceCount: services.length,
      inStockCount,
      lowStockCount,
      outOfStockCount,
      avgServicePrice
    }
  }, [inventory, services])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Valor del Inventario - Azul */}
      <Card className="relative overflow-hidden bg-white/80 dark:bg-slate-950/60 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 group rounded-2xl">
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Valor del Inventario
          </CardTitle>
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 rounded-xl border border-blue-200/50 dark:border-blue-800/50 group-hover:scale-110 transition-transform duration-300">
            <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-2xl font-black tracking-tight text-blue-600 dark:text-blue-400">
            {formatPrice(stats.totalSaleValue)}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800">
            <span>Costo base:</span>
            <strong className="text-slate-700 dark:text-slate-300 font-mono">{formatPrice(stats.totalCostValue)}</strong>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Repuestos en Depósito - Índigo/Púrpura */}
      <Card className="relative overflow-hidden bg-white/80 dark:bg-slate-950/60 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 group rounded-2xl">
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Repuestos Registrados
          </CardTitle>
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl border border-indigo-200/50 dark:border-indigo-800/50 group-hover:scale-110 transition-transform duration-300">
            <Package className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              {stats.productCount} <span className="text-xs font-medium text-muted-foreground">ítems</span>
            </div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/60">
              {stats.inStockCount} con stock
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800">
            <span>Unidades físicas:</span>
            <strong className="text-slate-700 dark:text-slate-300 font-bold">{stats.totalPhysicalUnits} u. en total</strong>
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Alertas de Stock - Naranja/Rojo */}
      <Card className="relative overflow-hidden bg-white/80 dark:bg-slate-950/60 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 group rounded-2xl">
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Alertas de Stock
          </CardTitle>
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 rounded-xl border border-amber-200/50 dark:border-amber-800/50 group-hover:scale-110 transition-transform duration-300">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black tracking-tight text-amber-600 dark:text-amber-400">
              {stats.lowStockCount}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">bajo stock</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800">
            <span className="text-muted-foreground flex items-center gap-1">
              <ShieldAlert className="h-3 w-3 text-red-500" /> Agotados (0 u.):
            </span>
            <strong className="text-red-600 dark:text-red-400 font-bold">{stats.outOfStockCount}</strong>
          </div>
        </CardContent>
      </Card>

      {/* Card 4: Catálogo de Servicios - Esmeralda */}
      <Card className="relative overflow-hidden bg-white/80 dark:bg-slate-950/60 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 group rounded-2xl">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Catálogo de Servicios
          </CardTitle>
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl border border-emerald-200/50 dark:border-emerald-800/50 group-hover:scale-110 transition-transform duration-300">
            <Wrench className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
            {stats.serviceCount} <span className="text-xs font-medium text-muted-foreground">servicios</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800">
            <span>Tarifa prom.:</span>
            <strong className="text-slate-700 dark:text-slate-300 font-semibold">{formatPrice(stats.avgServicePrice)}</strong>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

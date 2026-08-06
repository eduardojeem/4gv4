'use client'

import { useState } from 'react'
import { DateRange } from 'react-day-picker'
import { AlertTriangle, Loader2, RefreshCw, Info } from 'lucide-react'
import { toast } from 'sonner'
import { usePosStats } from './hooks/usePosStats'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

import { PosDashboardHeader, type PosDashboardViewTab } from './components/PosDashboardHeader'
import { PosStatsGrid } from './components/PosStatsGrid'
import { SalesTrendChart } from './components/SalesTrendChart'
import { PaymentDistributionChart } from './components/PaymentDistributionChart'
import { TopProductsCard } from './components/TopProductsCard'
import { RecentTransactionsList } from './components/RecentTransactionsList'
import { CreditStatsCards } from './components/CreditStatsCards'
import { RepairPosStatsCards } from './components/RepairPosStatsCards'
import { ProfitStatsCards } from './components/ProfitStatsCards'

export default function POSDashboard() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  })
  const [activeViewTab, setActiveViewTab] = useState<PosDashboardViewTab>('all')

  const { stats, loading, error, refetch } = usePosStats(dateRange)
  const [refreshing, setRefreshing] = useState(false)

  const handleExport = () => {
    try {
      if (!stats.recentSales.length) {
        toast.error('No hay datos para exportar')
        return
      }

      const headers = ['ID', 'Fecha', 'Cliente', 'Método pago', 'Total', 'Items']
      const rows = stats.recentSales.map((sale) => [
        sale.id,
        sale.created_at,
        sale.customer_name,
        sale.payment_method,
        formatCurrency(sale.total || 0),
        sale.items_count,
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n')

      const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `ventas_pos_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success('Exportación completada')
    } catch (e) {
      toast.error('Error al exportar datos')
      console.error(e)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
    toast.success('Datos actualizados')
  }

  if (loading && !stats.totalTransactions && !stats.repairStats.deliveredCount) {
    return (
      <div className="mx-auto flex max-w-[1480px] flex-col items-center justify-center gap-3 py-24">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <p className="text-sm text-slate-500">Cargando analíticas del POS...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900/50 dark:bg-red-950/20">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
          <p className="mt-3 text-sm font-semibold text-red-800 dark:text-red-300">
            Error al cargar datos
          </p>
          <p className="mt-1 text-xs text-red-700 dark:text-red-400">{error.message}</p>
          <Button onClick={() => refetch()} className="mt-4 gap-2" size="sm">
            <RefreshCw className="h-3.5 w-3.5" />
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
      {/* Header con pestañas de vista y filtro de fecha */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <PosDashboardHeader
          dateRange={dateRange}
          setDateRange={setDateRange}
          onExport={handleExport}
          activeViewTab={activeViewTab}
          setActiveViewTab={setActiveViewTab}
        />
      </div>

      {/* Guía de funcionamiento del Dashboard POS */}
      <Card className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-blue-100/50 dark:border-blue-950/20 backdrop-blur-md">
        <details className="group">
          <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden flex items-center justify-between p-5 pb-3">
            <div className="text-md font-bold flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <Info className="h-4.5 w-4.5" /> ¿Cómo funciona el Dashboard del POS y Taller?
            </div>
            <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 select-none">
              <span className="group-open:hidden flex items-center gap-1">Mostrar guía ↓</span>
              <span className="hidden group-open:flex items-center gap-1">Ocultar guía ↑</span>
            </div>
          </summary>
          <CardContent className="pt-0 pb-5 text-xs">
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-1.5 p-3.5 rounded-xl bg-background/60 border border-border/40 backdrop-blur-sm">
                <h4 className="font-semibold text-foreground flex items-center gap-1.5">
                  <Badge variant="secondary" className="h-4.5 w-4.5 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">1</Badge>
                  Filtro por Rango Fechas
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  Usa los atajos (Hoy, 7 días, Este mes) o el calendario para filtrar ventas, créditos y reparaciones.
                </p>
              </div>
              <div className="space-y-1.5 p-3.5 rounded-xl bg-background/60 border border-border/40 backdrop-blur-sm">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <Badge variant="secondary" className="h-4.5 w-4.5 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">2</Badge>

                  Filtro por Módulo
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  Usa los botones superiores para conmutar entre Vista General, Solo Ventas, Solo Reparaciones del Taller o Análisis de Ganancias.
                </p>
              </div>
              <div className="space-y-1.5 p-3.5 rounded-xl bg-background/60 border border-border/40 backdrop-blur-sm">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <Badge variant="secondary" className="h-4.5 w-4.5 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">3</Badge>
                  Métricas de Taller
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  Monitorea el total presupuestado de reparaciones ingresadas, recaudación por reparaciones entregadas y equipos en taller.
                </p>
              </div>
              <div className="space-y-1.5 p-3.5 rounded-xl bg-background/60 border border-border/40 backdrop-blur-sm">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <Badge variant="secondary" className="h-4.5 w-4.5 p-0 flex items-center justify-center rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">4</Badge>
                  Ganancias y Márgenes
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  Calcula la ganancia bruta considerando costo de mercadería vendida (CMV) y recaudación total del taller.
                </p>
              </div>
            </div>
          </CardContent>
        </details>
      </Card>

      {/* Refresh footer */}
      <div className="flex justify-end -mt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className="h-7 gap-1.5 text-xs text-slate-500"
        >
          <RefreshCw className={cn('h-3 w-3', (loading || refreshing) && 'animate-spin')} />
          Actualizar
        </Button>
      </div>

      {/* 1. KPIs Generales de Ventas (visible en 'all' o 'sales') */}
      {(activeViewTab === 'all' || activeViewTab === 'sales') && (
        <PosStatsGrid stats={stats} />
      )}

      {/* 2. Tarjetas de Reparaciones / Taller (visible en 'all' o 'repairs') */}
      {(activeViewTab === 'all' || activeViewTab === 'repairs') && (
        <RepairPosStatsCards stats={stats} />
      )}

      {/* 3. Tarjetas de Ganancias & Rentabilidad (visible en 'all' o 'profit') */}
      {(activeViewTab === 'all' || activeViewTab === 'profit') && (
        <ProfitStatsCards stats={stats} />
      )}

      {/* 4. Créditos (visible en 'all' o 'sales') */}
      {(activeViewTab === 'all' || activeViewTab === 'sales') && (
        <CreditStatsCards stats={stats} />
      )}

      {/* 5. Gráficos y Tablas */}
      {(activeViewTab === 'all' || activeViewTab === 'sales' || activeViewTab === 'profit') && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <SalesTrendChart data={stats.dailySales} />
            <PaymentDistributionChart data={stats.paymentMethods} />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <RecentTransactionsList sales={stats.recentSales} />
            <TopProductsCard products={stats.topProducts} />
          </div>
        </>
      )}
    </div>
  )
}

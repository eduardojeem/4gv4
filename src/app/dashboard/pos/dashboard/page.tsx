'use client'

import { useState } from 'react'
import { DateRange } from 'react-day-picker'
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { usePosStats } from './hooks/usePosStats'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'

import { PosDashboardHeader } from './components/PosDashboardHeader'
import { PosStatsGrid } from './components/PosStatsGrid'
import { SalesTrendChart } from './components/SalesTrendChart'
import { PaymentDistributionChart } from './components/PaymentDistributionChart'
import { TopProductsCard } from './components/TopProductsCard'
import { RecentTransactionsList } from './components/RecentTransactionsList'
import { CreditStatsCards } from './components/CreditStatsCards'

export default function POSDashboard() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  })

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

      const blob = new Blob(['﻿', csvContent], { type: 'text/csv;charset=utf-8;' })
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

  if (loading && !stats.totalTransactions) {
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
      {/* Header con refresh inline */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <PosDashboardHeader
          dateRange={dateRange}
          setDateRange={setDateRange}
          onExport={handleExport}
        />
      </div>

      {/* Refresh footer (small) */}
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

      {/* Stats */}
      <PosStatsGrid stats={stats} />

      {/* Credit stats (si aplica) */}
      <CreditStatsCards stats={stats} />

      {/* Charts row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <SalesTrendChart data={stats.dailySales} />
        <PaymentDistributionChart data={stats.paymentMethods} />
      </div>

      {/* Bottom row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <RecentTransactionsList sales={stats.recentSales} />
        <TopProductsCard products={stats.topProducts} />
      </div>
    </div>
  )
}

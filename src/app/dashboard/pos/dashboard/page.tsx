"use client"

import React, { useState } from 'react'
import { addDays } from 'date-fns'
import { DateRange } from 'react-day-picker'
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { usePosStats } from './hooks/usePosStats'
import { Button } from '@/components/ui/button'

// Components
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

  const handleExport = () => {
    // Basic CSV export functionality
    try {
      if (!stats.recentSales.length) {
        toast.error("No hay datos para exportar")
        return
      }

      const headers = ["ID", "Fecha", "Cliente", "Método Pago", "Total", "Items"]
      const rows = stats.recentSales.map(sale => [
        sale.id,
        sale.created_at,
        sale.customer_name,
        sale.payment_method,
        sale.total,
        sale.items_count
      ])

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.join(","))
      ].join("\n")

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute("download", `ventas_pos_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success("Exportación completada")
    } catch (e) {
      toast.error("Error al exportar datos")
      console.error(e)
    }
  }

  const handleRefresh = async () => {
    await refetch()
    toast.success("Datos actualizados")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px] p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Cargando datos del dashboard...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[500px] p-12 text-destructive gap-4">
        <p>Error al cargar datos: {error.message}</p>
        <Button variant="outline" onClick={() => refetch()}>Intentar de nuevo</Button>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PosDashboardHeader
          dateRange={dateRange}
          setDateRange={setDateRange}
          onExport={handleExport}
        />
        <Button variant="outline" size="icon" onClick={handleRefresh} title="Actualizar datos">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <PosStatsGrid stats={stats} />
      
      {/* Credit Stats Row */}
      <CreditStatsCards stats={stats} />

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <SalesTrendChart data={stats.dailySales} />
        <PaymentDistributionChart data={stats.paymentMethods} />
      </div>

      {/* Details Row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <RecentTransactionsList sales={stats.recentSales} />
        <TopProductsCard products={stats.topProducts} />
      </div>
    </div>
  )
}
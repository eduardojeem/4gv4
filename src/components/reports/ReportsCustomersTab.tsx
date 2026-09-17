'use client'

import React, { useMemo, useState } from 'react'
import {
  Users,
  CheckCircle2,
  ShoppingCart,
  Download,
  Search,
  Phone,
  Mail,
  Crown,
  TrendingUp,
  Sparkles,
  MessageCircle,
  Building2,
  AlertCircle,
  Globe,
  Store,
  FileText,
  Loader2,
  ArrowUpDown,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import type { CustomerAccessReport } from '@/lib/reports/customer-access-report'
import type { ReportContext } from '@/lib/reports/section-pdf-exporter'
import { exportCustomersSectionPDF } from '@/lib/reports/customer-pdf-exporter'
import { cn } from '@/lib/utils'

export interface CustomerReportItem {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  customerType: string
  totalSpent: number
  ordersCount: number
  averageTicket: number
  posSpent?: number
  posOrdersCount?: number
  webSpent?: number
  webOrdersCount?: number
  repairsSpent?: number
  repairsCount?: number
  channel?: 'all' | 'pos' | 'web' | 'both'
  lastPurchase: string | null
  firstPurchase: string | null
  isNew: boolean
  isRecurrent: boolean
}

export interface ReportsCustomersTabProps {
  brand?: string
  context?: ReportContext
  customerAccessReport: CustomerAccessReport | null
  customerAccessLoading: boolean
  customerAccessError: string | null
  customersNewCount: number
  retentionRate: number
  avgPurchasesPerCustomer: number
  buyersCount: number
  customersReportData: CustomerReportItem[]
  loading?: boolean
  hasRepairs?: boolean
  formatPrice: (val: number) => string
  formatFullPrice: (val: number) => string
}

function CustomerAccessMetric({
  label,
  value,
  description,
  tone = 'slate',
}: {
  label: string
  value: number
  description: string
  tone?: 'slate' | 'blue' | 'emerald' | 'amber'
}) {
  const tones = {
    slate: 'border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white',
    blue: 'border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-300',
    emerald: 'border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300',
    amber: 'border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-300',
  }
  return (
    <div className={cn('rounded-xl border bg-slate-50/50 p-3.5 dark:bg-slate-900/40', tones[tone])}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{value.toLocaleString('es-PY')}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

export function ReportsCustomersTab({
  brand,
  context,
  customerAccessReport,
  customerAccessLoading,
  customerAccessError,
  customersNewCount,
  retentionRate,
  avgPurchasesPerCustomer,
  buyersCount,
  customersReportData,
  loading = false,
  hasRepairs = false,
  formatPrice,
  formatFullPrice,
}: ReportsCustomersTabProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [channelFilter, setChannelFilter] = useState<'all' | 'pos' | 'web' | 'both' | 'repairs'>('all')
  const [segmentFilter, setSegmentFilter] = useState<'all' | 'recurrent' | 'new' | 'vip'>('all')
  const [sortBy, setSortBy] = useState<'sales' | 'orders' | 'recent' | 'pos' | 'web' | 'repairs'>('sales')
  const [topLimit, setTopLimit] = useState<number>(25)
  const [isExportingPdf, setIsExportingPdf] = useState(false)

  // Estadísticas consolidadas por canal de venta (POS vs Web vs Taller)
  const channelStats = useMemo(() => {
    let posOnlyCount = 0
    let webOnlyCount = 0
    let bothCount = 0
    let totalPosRevenue = 0
    let totalWebRevenue = 0
    let totalRepairsRevenue = 0
    let totalPosOrders = 0
    let totalWebOrders = 0
    let totalRepairsCount = 0
    let repairsCustomersCount = 0

    customersReportData.forEach((c) => {
      const pSpent = c.posSpent ?? 0
      const wSpent = c.webSpent ?? 0
      const pOrders = c.posOrdersCount ?? 0
      const wOrders = c.webOrdersCount ?? 0
      const rSpent = c.repairsSpent ?? 0
      const rCount = c.repairsCount ?? 0

      totalPosRevenue += pSpent
      totalWebRevenue += wSpent
      totalRepairsRevenue += rSpent
      totalPosOrders += pOrders
      totalWebOrders += wOrders
      totalRepairsCount += rCount
      if (rCount > 0) repairsCustomersCount++

      if (pOrders > 0 && wOrders > 0) {
        bothCount++
      } else if (wOrders > 0) {
        webOnlyCount++
      } else if (pOrders > 0) {
        posOnlyCount++
      }
    })

    const totalRevenue = totalPosRevenue + totalWebRevenue + totalRepairsRevenue

    return {
      posOnlyCount,
      webOnlyCount,
      bothCount,
      totalPosRevenue,
      totalWebRevenue,
      totalRepairsRevenue,
      totalPosOrders,
      totalWebOrders,
      totalRepairsCount,
      repairsCustomersCount,
      totalRevenue,
      posPct: totalRevenue > 0 ? (totalPosRevenue / totalRevenue) * 100 : 0,
      webPct: totalRevenue > 0 ? (totalWebRevenue / totalRevenue) * 100 : 0,
      repairsPct: totalRevenue > 0 ? (totalRepairsRevenue / totalRevenue) * 100 : 0,
    }
  }, [customersReportData])

  // Filtrado y ordenamiento de clientes
  const filteredCustomers = useMemo(() => {
    let list = [...customersReportData]

    // 1. Búsqueda por texto (nombre, teléfono, email)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
      )
    }

    // 2. Filtro por canal (Local / POS vs Tienda Web vs Ambos vs Taller)
    if (channelFilter === 'pos') {
      list = list.filter((c) => (c.posOrdersCount ?? 0) > 0 && (c.webOrdersCount ?? 0) === 0)
    } else if (channelFilter === 'web') {
      list = list.filter((c) => (c.webOrdersCount ?? 0) > 0 && (c.posOrdersCount ?? 0) === 0)
    } else if (channelFilter === 'both') {
      list = list.filter((c) => (c.posOrdersCount ?? 0) > 0 && (c.webOrdersCount ?? 0) > 0)
    } else if (channelFilter === 'repairs') {
      list = list.filter((c) => (c.repairsCount ?? 0) > 0)
    }

    // 3. Filtro por segmento de cliente
    if (segmentFilter === 'recurrent') {
      list = list.filter((c) => c.isRecurrent)
    } else if (segmentFilter === 'new') {
      list = list.filter((c) => c.isNew)
    } else if (segmentFilter === 'vip') {
      list = list.filter(
        (c) => c.customerType === 'premium' || c.customerType === 'empresa' || c.customerType === 'wholesale'
      )
    }

    // 4. Ordenamiento
    list.sort((a, b) => {
      if (sortBy === 'sales') return b.totalSpent - a.totalSpent
      if (sortBy === 'pos') return (b.posSpent ?? 0) - (a.posSpent ?? 0)
      if (sortBy === 'web') return (b.webSpent ?? 0) - (a.webSpent ?? 0)
      if (sortBy === 'repairs') return (b.repairsSpent ?? 0) - (a.repairsSpent ?? 0)
      if (sortBy === 'orders') return b.ordersCount - a.ordersCount
      if (sortBy === 'recent') {
        const da = a.lastPurchase ? new Date(a.lastPurchase).getTime() : 0
        const db = b.lastPurchase ? new Date(b.lastPurchase).getTime() : 0
        return db - da
      }
      return 0
    })

    return list
  }, [customersReportData, searchQuery, channelFilter, segmentFilter, sortBy])

  const visibleCustomers = useMemo(() => {
    if (topLimit <= 0) return filteredCustomers
    return filteredCustomers.slice(0, topLimit)
  }, [filteredCustomers, topLimit])

  const maxCustomerSales = useMemo(() => {
    return Math.max(...customersReportData.map((c) => c.totalSpent), 1)
  }, [customersReportData])

  const totalSalesToIdentified = useMemo(() => {
    return customersReportData.reduce((sum, c) => sum + c.totalSpent, 0)
  }, [customersReportData])

  const topCustomer = customersReportData[0]

  // Exportar PDF de clientes
  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true)
      await exportCustomersSectionPDF({
        title: `Reporte de Clientes y Canales${brand ? ` - ${brand}` : ''}`,
        // El reporte puede no traer el desglose por canal de un cliente; el PDF
        // lo necesita completo, así que lo que falta cuenta como cero.
        customers: filteredCustomers.map((customer) => ({
          ...customer,
          posSpent: customer.posSpent ?? 0,
          posOrdersCount: customer.posOrdersCount ?? 0,
          webSpent: customer.webSpent ?? 0,
          webOrdersCount: customer.webOrdersCount ?? 0,
          channel: customer.channel ?? 'all',
        })),
        metrics: {
          totalCustomers: customersReportData.length,
          totalSpent: totalSalesToIdentified,
          totalPosSpent: channelStats.totalPosRevenue,
          totalWebSpent: channelStats.totalWebRevenue,
          totalRepairsSpent: channelStats.totalRepairsRevenue,
          totalPosOrders: channelStats.totalPosOrders,
          totalWebOrders: channelStats.totalWebOrders,
          totalRepairsCount: channelStats.totalRepairsCount,
          posOnlyCustomers: channelStats.posOnlyCount,
          webOnlyCustomers: channelStats.webOnlyCount,
          hybridCustomers: channelStats.bothCount,
          repairsCustomers: channelStats.repairsCustomersCount,
          recurrentCount: customersReportData.filter((c) => c.isRecurrent).length,
          newCount: customersNewCount,
          retentionRate,
          avgTicket: buyersCount > 0 ? totalSalesToIdentified / buyersCount : 0,
        },
        hasRepairs,
        context,
      })
      toast.success(`Reporte PDF descargado (${filteredCustomers.length} clientes).`)
    } catch (error) {
      toast.error('No se pudo generar el reporte PDF.', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setIsExportingPdf(false)
    }
  }

  // Exportar CSV de clientes con detalle de canales
  const handleExportCsv = () => {
    try {
      const repairsHeaders = hasRepairs
        ? ['Facturación Taller (Gs.)', 'Reparaciones (Cant.)']
        : []
      const headers = [
        'Ranking',
        'Nombre del Cliente',
        'Teléfono',
        'Email',
        'Canal Principal',
        'Total Comprado (Gs.)',
        'Facturación Local (Gs.)',
        'Compras Local (Cant.)',
        'Facturación Web (Gs.)',
        'Pedidos Web (Cant.)',
        ...repairsHeaders,
        'Cantidad Total Compras',
        'Ticket Promedio (Gs.)',
        'Segmento',
        'Última Compra',
        'Cliente Nuevo en Período',
        'Es Recurrente',
      ]

      const rows = filteredCustomers.map((c, index) => {
        let channelStr = 'Solo Local (POS)'
        if ((c.posOrdersCount ?? 0) > 0 && (c.webOrdersCount ?? 0) > 0) {
          channelStr = 'Omnicanal (Ambos)'
        } else if ((c.webOrdersCount ?? 0) > 0) {
          channelStr = 'Solo Tienda Web'
        } else if ((c.repairsCount ?? 0) > 0 && (c.posOrdersCount ?? 0) === 0 && (c.webOrdersCount ?? 0) === 0) {
          channelStr = 'Solo Taller'
        }

        const repairsCols = hasRepairs
          ? [String(Math.round(c.repairsSpent ?? 0)), String(c.repairsCount ?? 0)]
          : []

        return [
          String(index + 1),
          `"${(c.name || '').replace(/"/g, '""')}"`,
          `"${(c.phone || '').replace(/"/g, '""')}"`,
          `"${(c.email || '').replace(/"/g, '""')}"`,
          channelStr,
          String(Math.round(c.totalSpent)),
          String(Math.round(c.posSpent ?? 0)),
          String(c.posOrdersCount ?? 0),
          String(Math.round(c.webSpent ?? 0)),
          String(c.webOrdersCount ?? 0),
          ...repairsCols,
          String(c.ordersCount),
          String(Math.round(c.averageTicket)),
          c.customerType,
          c.lastPurchase ? new Date(c.lastPurchase).toLocaleDateString('es-PY') : 'Sin registro',
          c.isNew ? 'Sí' : 'No',
          c.isRecurrent ? 'Sí' : 'No',
        ]
      })

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte-clientes-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success(`CSV de clientes descargado (${filteredCustomers.length} clientes).`)
    } catch (error) {
      toast.error('No se pudo generar el CSV.', {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Métricas Principales de Actividad y Fidelización */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="rounded-2xl border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[#0d1117]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted-foreground">Compradores Activos</p>
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-foreground">
            {buyersCount.toLocaleString('es-PY')}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Clientes identificados con compra
          </p>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[#0d1117]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted-foreground">Ventas a Clientes</p>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatPrice(totalSalesToIdentified)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Facturación en el período
          </p>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[#0d1117]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted-foreground">Tasa de Recurrencia</p>
            <div className="rounded-lg bg-violet-500/10 p-2 text-violet-600 dark:text-violet-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-violet-600 dark:text-violet-400">
            {retentionRate.toFixed(1)}%
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Compraron 2 o más veces
          </p>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[#0d1117]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted-foreground">Frecuencia Media</p>
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-amber-600 dark:text-amber-400">
            {avgPurchasesPerCustomer.toFixed(1)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Compras promedio por cliente
          </p>
        </Card>
      </div>

      {/* 2. Desglose de Canales: Local / POS vs Tienda Web (E-commerce) vs Híbridos vs Taller */}
      <div className={cn('grid grid-cols-1 gap-3', hasRepairs ? 'sm:grid-cols-4' : 'sm:grid-cols-3')}>
        {/* Canal Local */}
        <Card
          onClick={() => setChannelFilter((prev) => (prev === 'pos' ? 'all' : 'pos'))}
          className={cn(
            'cursor-pointer rounded-2xl border p-4 transition-all hover:shadow-sm',
            channelFilter === 'pos'
              ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20 dark:border-emerald-500 dark:bg-emerald-950/30'
              : 'border-slate-200/80 bg-white dark:border-white/10 dark:bg-[#0d1117]'
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
                <Store className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Canal Local / POS</p>
                <p className="text-[11px] text-muted-foreground">Ventas en mostrador / salón</p>
              </div>
            </div>
            <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-[10px] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              {channelStats.posPct.toFixed(1)}% total
            </Badge>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="font-mono text-xl font-bold text-foreground">
              {formatFullPrice(channelStats.totalPosRevenue)}
            </p>
            <span className="text-xs text-muted-foreground font-medium">
              {channelStats.totalPosOrders} ventas
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {channelStats.posOnlyCount} clientes compran exclusivamente en local
          </p>
        </Card>

        {/* Canal Tienda Web */}
        <Card
          onClick={() => setChannelFilter((prev) => (prev === 'web' ? 'all' : 'web'))}
          className={cn(
            'cursor-pointer rounded-2xl border p-4 transition-all hover:shadow-sm',
            channelFilter === 'web'
              ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20 dark:border-blue-500 dark:bg-blue-950/30'
              : 'border-slate-200/80 bg-white dark:border-white/10 dark:bg-[#0d1117]'
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400">
                <Globe className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Canal Tienda Web</p>
                <p className="text-[11px] text-muted-foreground">Pedidos online / e-commerce</p>
              </div>
            </div>
            <Badge variant="outline" className="border-blue-300 bg-blue-50 text-[10px] text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
              {channelStats.webPct.toFixed(1)}% total
            </Badge>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="font-mono text-xl font-bold text-foreground">
              {formatFullPrice(channelStats.totalWebRevenue)}
            </p>
            <span className="text-xs text-muted-foreground font-medium">
              {channelStats.totalWebOrders} pedidos
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {channelStats.webOnlyCount} clientes compran exclusivamente online
          </p>
        </Card>

        {/* Omnicanal (Ambos) */}
        <Card
          onClick={() => setChannelFilter((prev) => (prev === 'both' ? 'all' : 'both'))}
          className={cn(
            'cursor-pointer rounded-2xl border p-4 transition-all hover:shadow-sm',
            channelFilter === 'both'
              ? 'border-purple-500 bg-purple-50/50 ring-2 ring-purple-500/20 dark:border-purple-500 dark:bg-purple-950/30'
              : 'border-slate-200/80 bg-white dark:border-white/10 dark:bg-[#0d1117]'
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-purple-500/10 p-2 text-purple-600 dark:text-purple-400">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Clientes Omnicanal</p>
                <p className="text-[11px] text-muted-foreground">Compran en Local y en Web</p>
              </div>
            </div>
            <Badge variant="outline" className="border-purple-300 bg-purple-50 text-[10px] text-purple-800 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300">
              Alta Fidelidad
            </Badge>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="font-mono text-xl font-bold text-purple-700 dark:text-purple-300">
              {channelStats.bothCount} clientes
            </p>
            <span className="text-xs text-muted-foreground font-medium">
              Híbridos
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Clientes de mayor retención y ticket cruzado
          </p>
        </Card>

        {/* Canal Taller / Reparaciones — solo cuando el módulo está activo */}
        {hasRepairs && (
          <Card
            onClick={() => setChannelFilter((prev) => (prev === 'repairs' ? 'all' : 'repairs'))}
            className={cn(
              'cursor-pointer rounded-2xl border p-4 transition-all hover:shadow-sm',
              channelFilter === 'repairs'
                ? 'border-orange-500 bg-orange-50/50 ring-2 ring-orange-500/20 dark:border-orange-500 dark:bg-orange-950/30'
                : 'border-slate-200/80 bg-white dark:border-white/10 dark:bg-[#0d1117]'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-orange-500/10 p-2 text-orange-600 dark:text-orange-400">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Canal Taller</p>
                  <p className="text-[11px] text-muted-foreground">Reparaciones / servicio técnico</p>
                </div>
              </div>
              <Badge variant="outline" className="border-orange-300 bg-orange-50 text-[10px] text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300">
                {channelStats.repairsPct.toFixed(1)}% total
              </Badge>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <p className="font-mono text-xl font-bold text-foreground">
                {formatFullPrice(channelStats.totalRepairsRevenue)}
              </p>
              <span className="text-xs text-muted-foreground font-medium">
                {channelStats.totalRepairsCount} reparaciones
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {channelStats.repairsCustomersCount} clientes con servicio de taller
            </p>
          </Card>
        )}
      </div>

      {/* 3. Tarjeta del Cliente Líder del Período (Podio #1) */}
      {topCustomer && topCustomer.totalSpent > 0 ? (
        <Card className="overflow-hidden rounded-2xl border-amber-300/60 bg-gradient-to-r from-amber-50/60 via-amber-50/20 to-transparent p-5 shadow-xs dark:border-amber-900/40 dark:from-amber-950/20 dark:via-transparent">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
                <Crown className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-amber-400 bg-amber-100/60 text-[10px] font-bold text-amber-900 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    Cliente #1 del Período
                  </Badge>
                  {topCustomer.isRecurrent ? (
                    <Badge variant="secondary" className="text-[10px]">Recurrente</Badge>
                  ) : null}
                  {(topCustomer.posOrdersCount ?? 0) > 0 && (topCustomer.webOrdersCount ?? 0) > 0 ? (
                    <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 text-[10px]">
                      Omnicanal
                    </Badge>
                  ) : (topCustomer.webOrdersCount ?? 0) > 0 ? (
                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 text-[10px]">
                      Web
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px]">
                      Local / POS
                    </Badge>
                  )}
                </div>
                <h3 className="mt-1 text-base font-bold text-foreground sm:text-lg">
                  {topCustomer.name}
                </h3>
                <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {topCustomer.phone ? (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {topCustomer.phone}
                    </span>
                  ) : null}
                  {topCustomer.email ? (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {topCustomer.email}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 border-t pt-3 sm:border-t-0 sm:pt-0 sm:text-right">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total Comprado</p>
                <p className="mt-0.5 font-mono text-xl font-extrabold text-amber-700 dark:text-amber-300">
                  {formatFullPrice(topCustomer.totalSpent)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Operaciones</p>
                <p className="mt-0.5 font-mono text-xl font-extrabold text-foreground">
                  {topCustomer.ordersCount}
                </p>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {/* 4. Ranking de Clientes con Búsqueda, Filtros de Canal y Descarga (PDF / CSV) */}
      <Card className="rounded-2xl border-slate-200/80 bg-white shadow-xs dark:border-white/10 dark:bg-[#0d1117]">
        <CardHeader className="border-b border-border/40 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                Ranking de Compradores
              </CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Comportamiento de clientes filtrado por canales de compra y recurrencia
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Botón Descargar PDF */}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-semibold border-rose-200 bg-rose-50/50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300 shadow-xs"
                onClick={handleExportPdf}
                disabled={filteredCustomers.length === 0 || isExportingPdf}
              >
                {isExportingPdf ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileText className="h-3.5 w-3.5" />
                )}
                Descargar PDF
              </Button>

              {/* Botón Descargar CSV */}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-semibold shadow-xs"
                onClick={handleExportCsv}
                disabled={filteredCustomers.length === 0}
              >
                <Download className="h-3.5 w-3.5" />
                Descargar CSV
              </Button>
            </div>
          </div>

          {/* Barra de Filtros y Controles */}
          <div className="mt-3 flex flex-col gap-2.5 pt-2">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              {/* Buscador */}
              <div className="relative min-w-0 flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente por nombre, teléfono o email…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 text-xs"
                />
              </div>

              {/* Controles: Orden y Límite */}
              <div className="flex items-center gap-2">
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                  <SelectTrigger className="h-9 w-44 text-xs font-medium">
                    <SelectValue placeholder="Ordenar por" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">Mayor Facturación Total</SelectItem>
                    <SelectItem value="pos">Mayor Venta Local (POS)</SelectItem>
                    <SelectItem value="web">Mayor Venta Web (Online)</SelectItem>
                    {hasRepairs && (
                      <SelectItem value="repairs">Mayor Taller (Reparaciones)</SelectItem>
                    )}
                    <SelectItem value="orders">Más Compras Realizadas</SelectItem>
                    <SelectItem value="recent">Última Compra Reciente</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={String(topLimit)} onValueChange={(v) => setTopLimit(Number(v))}>
                  <SelectTrigger className="h-9 w-28 text-xs font-medium">
                    <SelectValue placeholder="Cantidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">Top 10</SelectItem>
                    <SelectItem value="25">Top 25</SelectItem>
                    <SelectItem value="50">Top 50</SelectItem>
                    <SelectItem value="0">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Filtros rápidos: Canal y Segmento */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2.5">
              {/* Filtro por Canal de Venta */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase text-muted-foreground">Canal:</span>
                <div className="flex rounded-lg border border-border bg-muted/30 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setChannelFilter('all')}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                      channelFilter === 'all'
                        ? 'bg-background font-semibold text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannelFilter('pos')}
                    className={cn(
                      'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                      channelFilter === 'pos'
                        ? 'bg-background font-semibold text-emerald-700 dark:text-emerald-300 shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Store className="h-3 w-3" />
                    Local / POS ({channelStats.posOnlyCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannelFilter('web')}
                    className={cn(
                      'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                      channelFilter === 'web'
                        ? 'bg-background font-semibold text-blue-700 dark:text-blue-300 shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Globe className="h-3 w-3" />
                    Tienda Web ({channelStats.webOnlyCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannelFilter('both')}
                    className={cn(
                      'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                      channelFilter === 'both'
                        ? 'bg-background font-semibold text-purple-700 dark:text-purple-300 shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Sparkles className="h-3 w-3" />
                    Híbridos ({channelStats.bothCount})
                  </button>
                  {hasRepairs && (
                    <button
                      type="button"
                      onClick={() => setChannelFilter((prev) => (prev === 'repairs' ? 'all' : 'repairs'))}
                      className={cn(
                        'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                        channelFilter === 'repairs'
                          ? 'bg-background font-semibold text-orange-700 dark:text-orange-300 shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      🔧 Taller ({channelStats.repairsCustomersCount})
                    </button>
                  )}
                </div>
              </div>

              {/* Filtro por Segmento */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase text-muted-foreground">Segmento:</span>
                <div className="flex rounded-lg border border-border bg-muted/30 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setSegmentFilter('all')}
                    className={cn(
                      'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                      segmentFilter === 'all'
                        ? 'bg-background font-semibold text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setSegmentFilter('recurrent')}
                    className={cn(
                      'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                      segmentFilter === 'recurrent'
                        ? 'bg-background font-semibold text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Recurrentes
                  </button>
                  <button
                    type="button"
                    onClick={() => setSegmentFilter('new')}
                    className={cn(
                      'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                      segmentFilter === 'new'
                        ? 'bg-background font-semibold text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Nuevos
                  </button>
                  <button
                    type="button"
                    onClick={() => setSegmentFilter('vip')}
                    className={cn(
                      'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                      segmentFilter === 'vip'
                        ? 'bg-background font-semibold text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    VIP / Empresa
                  </button>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : visibleCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-3 text-muted-foreground">
                <Users className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">
                No se encontraron clientes
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {searchQuery
                  ? `No hay coincidencias para "${searchQuery}".`
                  : 'No se registraron compras identificadas con los filtros seleccionados.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {visibleCustomers.map((customer, index) => {
                const widthPct = Math.max(3, Math.round((customer.totalSpent / maxCustomerSales) * 100))
                const cleanPhone = customer.phone?.replace(/\D/g, '')

                const hasPos = (customer.posOrdersCount ?? 0) > 0
                const hasWeb = (customer.webOrdersCount ?? 0) > 0
                const hasRepairsData = hasRepairs && (customer.repairsCount ?? 0) > 0
                const isBoth = hasPos && hasWeb

                return (
                  <div
                    key={`customer-${customer.id}-${index}`}
                    className="rounded-xl border border-slate-200/70 bg-slate-50/40 p-3.5 transition-all hover:border-blue-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/30 dark:hover:border-blue-800"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      {/* Lado izquierdo: Puesto + Nombre + Badges + Contacto */}
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                            index === 0
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : index === 1
                              ? 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                              : index === 2
                              ? 'bg-amber-800/10 text-amber-900 dark:bg-amber-900/30 dark:text-amber-400'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400'
                          )}
                        >
                          #{index + 1}
                        </span>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-sm text-foreground truncate">
                              {customer.name}
                            </p>

                            {/* Badge de Canal de Compra */}
                            {isBoth ? (
                              <Badge variant="outline" className="border-purple-300 bg-purple-50 text-[10px] text-purple-800 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 font-semibold gap-1">
                                <Sparkles className="h-2.5 w-2.5 text-purple-600 dark:text-purple-400" />
                                Omnicanal
                              </Badge>
                            ) : hasWeb ? (
                              <Badge variant="outline" className="border-blue-300 bg-blue-50 text-[10px] text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 font-semibold gap-1">
                                <Globe className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400" />
                                Tienda Web
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-[10px] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold gap-1">
                                <Store className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                                Local / POS
                              </Badge>
                            )}

                            {/* Badge de Taller */}
                            {hasRepairsData && (
                              <Badge variant="outline" className="border-orange-300 bg-orange-50 text-[10px] text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300 font-semibold">
                                🔧 Taller ({customer.repairsCount})
                              </Badge>
                            )}

                            {customer.isRecurrent ? (
                              <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-[10px] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-medium">
                                Recurrente
                              </Badge>
                            ) : null}
                            {customer.isNew ? (
                              <Badge variant="outline" className="border-blue-300 bg-blue-50 text-[10px] text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 font-medium">
                                Nuevo
                              </Badge>
                            ) : null}
                            {customer.customerType === 'empresa' ? (
                              <Badge variant="secondary" className="text-[10px] gap-1">
                                <Building2 className="h-2.5 w-2.5" /> Empresa
                              </Badge>
                            ) : customer.customerType === 'premium' ? (
                              <Badge variant="secondary" className="text-[10px] gap-1">
                                <Crown className="h-2.5 w-2.5 text-amber-500" /> VIP
                              </Badge>
                            ) : null}
                          </div>

                          <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {customer.phone ? (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                <span>{customer.phone}</span>
                                {cleanPhone ? (
                                  <a
                                    href={`https://wa.me/${cleanPhone}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="ml-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                                    title="Contactar por WhatsApp"
                                  >
                                    <MessageCircle className="h-3 w-3" />
                                  </a>
                                ) : null}
                              </span>
                            ) : null}
                            {customer.email ? (
                              <span className="flex items-center gap-1 truncate max-w-xs">
                                <Mail className="h-3 w-3 text-muted-foreground" />
                                <span className="truncate">{customer.email}</span>
                              </span>
                            ) : null}
                            {customer.lastPurchase ? (
                              <span>
                                Última compra: {new Date(customer.lastPurchase).toLocaleDateString('es-PY')}
                              </span>
                            ) : null}
                          </div>

                          {/* Subtítulo de canal: detalle exacto de compras en Local vs Web vs Taller */}
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                            {isBoth ? (
                              <span>
                                Local: <strong className="text-emerald-700 dark:text-emerald-400">{formatPrice(customer.posSpent || 0)}</strong> ({customer.posOrdersCount} ops) · Web: <strong className="text-blue-700 dark:text-blue-400">{formatPrice(customer.webSpent || 0)}</strong> ({customer.webOrdersCount} ped){hasRepairsData ? <> · Taller: <strong className="text-orange-700 dark:text-orange-400">{formatPrice(customer.repairsSpent || 0)}</strong> ({customer.repairsCount} rep)</> : null}
                              </span>
                            ) : hasWeb ? (
                              <span>
                                100% Pedidos Web: <strong className="text-blue-700 dark:text-blue-400">{formatPrice(customer.webSpent || 0)}</strong> ({customer.webOrdersCount} pedidos online){hasRepairsData ? <> · Taller: <strong className="text-orange-700 dark:text-orange-400">{formatPrice(customer.repairsSpent || 0)}</strong> ({customer.repairsCount} rep)</> : null}
                              </span>
                            ) : hasRepairsData && !hasPos ? (
                              <span>
                                100% Taller: <strong className="text-orange-700 dark:text-orange-400">{formatPrice(customer.repairsSpent || 0)}</strong> ({customer.repairsCount} reparaciones)
                              </span>
                            ) : (
                              <span>
                                100% Compras en Salón / POS: <strong className="text-emerald-700 dark:text-emerald-400">{formatPrice(customer.posSpent || 0)}</strong> ({customer.posOrdersCount} compras){hasRepairsData ? <> · Taller: <strong className="text-orange-700 dark:text-orange-400">{formatPrice(customer.repairsSpent || 0)}</strong> ({customer.repairsCount} rep)</> : null}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Lado derecho: Total + Compras + Ticket promedio */}
                      <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 pl-10 sm:pl-0">
                        <div className="text-left sm:text-right">
                          <p className="font-mono text-base font-bold text-foreground">
                            {formatFullPrice(customer.totalSpent)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {customer.ordersCount} {customer.ordersCount === 1 ? 'operación' : 'operaciones'} · Prom: {formatPrice(customer.averageTicket)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Barra de progreso visual relativa con indicador de canal */}
                    <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/60 dark:bg-slate-800">
                      {isBoth || hasRepairsData ? (
                        <div className="flex h-full rounded-full overflow-hidden" style={{ width: `${widthPct}%` }}>
                          {hasPos && (
                            <div
                              className="h-full bg-emerald-600 dark:bg-emerald-500"
                              style={{ width: `${customer.totalSpent > 0 ? ((customer.posSpent || 0) / customer.totalSpent) * 100 : 0}%` }}
                              title="Proporción compras Local"
                            />
                          )}
                          {hasWeb && (
                            <div
                              className="h-full bg-blue-600 dark:bg-blue-500"
                              style={{ width: `${customer.totalSpent > 0 ? ((customer.webSpent || 0) / customer.totalSpent) * 100 : 0}%` }}
                              title="Proporción pedidos Web"
                            />
                          )}
                          {hasRepairsData && (
                            <div
                              className="h-full bg-orange-500 dark:bg-orange-400"
                              style={{ width: `${customer.totalSpent > 0 ? ((customer.repairsSpent || 0) / customer.totalSpent) * 100 : 0}%` }}
                              title="Proporción Taller"
                            />
                          )}
                        </div>
                      ) : (
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-300',
                            hasWeb ? 'bg-blue-600 dark:bg-blue-500' : 'bg-emerald-600 dark:bg-emerald-500'
                          )}
                          style={{ width: `${widthPct}%` }}
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Estado de Acceso al Portal Público de Clientes */}
      <Card className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-white/10 dark:bg-[#0d1117]">
        <CardHeader className="border-b border-border/40 pb-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Acceso de Clientes al Portal Público
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Estado de activación de cuentas de clientes para autogestión de fichas y reparaciones
              </p>
            </div>
            {customerAccessReport ? (
              <span className="mt-2 inline-flex w-fit rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 sm:mt-0 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                {customerAccessReport.adoptionRate.toFixed(1)}% con acceso
              </span>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          {customerAccessLoading && !customerAccessReport ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : customerAccessError ? (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {customerAccessError}
            </div>
          ) : customerAccessReport ? (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <CustomerAccessMetric
                  label="Total registrados"
                  value={customerAccessReport.total}
                  description="Base completa de clientes"
                  tone="slate"
                />
                <CustomerAccessMetric
                  label="Clientes comunes"
                  value={customerAccessReport.standardCustomers}
                  description="Sin cuenta vinculada"
                  tone="blue"
                />
                <CustomerAccessMetric
                  label="Acceso público activo"
                  value={customerAccessReport.portalActive}
                  description="Cuenta y membresía activas"
                  tone="emerald"
                />
                <CustomerAccessMetric
                  label="Requieren revisión"
                  value={customerAccessReport.needsReview}
                  description="Vínculo incompleto o inactivo"
                  tone="amber"
                />
              </div>
              <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
                Un cliente puede ingresar cuando su ficha está vinculada a una cuenta y esa cuenta tiene una membresía activa en la organización.
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

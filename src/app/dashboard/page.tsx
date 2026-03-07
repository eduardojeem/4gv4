"use client"

import { Suspense, useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ShoppingCart,
  Users,
  Package,
  AlertTriangle,
  ArrowRight,
  Zap,
  Clock,
  Activity,
  BarChart3,
  RefreshCw,
  Banknote,
  Wrench,
  TrendingUp,
  TrendingDown,
  Minus,
  Inbox
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { config } from '@/lib/config'
import { formatCurrency } from '@/lib/currency'
import { COMPLETED_SALE_STATUSES, PENDING_SALE_STATUSES, isCompletedSaleStatus } from '@/lib/sales-status'

// Dynamic imports optimized for Next.js
const RecentActivity = dynamic(
  () => import('@/components/dashboard/stats-overview').then(m => m.RecentActivity),
  { ssr: false }
)

// Mini Sparkline Chart (inline - no dependency)
function MiniSparkline({ data, color = '#3b82f6' }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const w = 100
  const h = 40
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-24 h-10 opacity-70" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  )
}

type KpiColor = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan'

interface KpiStat {
  title: string
  value: string | number
  subtitle?: string
  change?: { value: number; label: string; type: 'increase' | 'decrease' }
  icon: LucideIcon
  color: KpiColor
  href: string
  trend?: number[]
}

const colorMap: Record<KpiColor, { bg: string; text: string; border: string; iconBg: string }> = {
  green:  {
    bg:     'bg-emerald-50/80 dark:bg-emerald-950/40',
    text:   'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800/60',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
  },
  blue:   {
    bg:     'bg-blue-50/80 dark:bg-blue-950/40',
    text:   'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800/60',
    iconBg: 'bg-blue-100 dark:bg-blue-900/50',
  },
  purple: {
    bg:     'bg-violet-50/80 dark:bg-violet-950/40',
    text:   'text-violet-700 dark:text-violet-300',
    border: 'border-violet-200 dark:border-violet-800/60',
    iconBg: 'bg-violet-100 dark:bg-violet-900/50',
  },
  cyan:   {
    bg:     'bg-cyan-50/80 dark:bg-cyan-950/40',
    text:   'text-cyan-700 dark:text-cyan-300',
    border: 'border-cyan-200 dark:border-cyan-800/60',
    iconBg: 'bg-cyan-100 dark:bg-cyan-900/50',
  },
  orange: {
    bg:     'bg-amber-50/80 dark:bg-amber-950/40',
    text:   'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800/60',
    iconBg: 'bg-amber-100 dark:bg-amber-900/50',
  },
  red:    {
    bg:     'bg-rose-50/80 dark:bg-rose-950/40',
    text:   'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800/60',
    iconBg: 'bg-rose-100 dark:bg-rose-900/50',
  },
}

function KpiCard({ stat, loading }: { stat: KpiStat; loading: boolean }) {
  const c = colorMap[stat.color]
  if (loading) {
    return (
      <Card className={`border ${c.border} ${c.bg} overflow-hidden`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
          <Skeleton className="h-8 w-24 mb-2" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    )
  }
  return (
    <Link href={stat.href} className="block group">
      <Card className={`border ${c.border} ${c.bg} overflow-hidden hover:shadow-md transition-all duration-200 group-hover:scale-[1.01]`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
            <div className={`p-2 rounded-lg ${c.iconBg}`}>
              <stat.icon className={`h-5 w-5 ${c.text}`} />
            </div>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground">{stat.value}</p>
              {stat.subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5">{stat.subtitle}</p>
              )}
              {stat.change && (
                <div className="flex items-center gap-1 mt-1.5">
                  {stat.change.type === 'increase'
                    ? <TrendingUp className="h-3 w-3 text-green-500" />
                    : stat.change.type === 'decrease'
                    ? <TrendingDown className="h-3 w-3 text-red-500" />
                    : <Minus className="h-3 w-3 text-muted-foreground" />
                  }
                  <span className="text-xs text-muted-foreground">{stat.change.label}</span>
                </div>
              )}
            </div>
            {stat.trend && stat.trend.length > 1 && (
              <MiniSparkline
                data={stat.trend}
                color={stat.color === 'green' ? '#22c55e' : stat.color === 'red' ? '#ef4444' : '#3b82f6'}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default function DashboardPage() {
  const [isPending, startTransition] = useTransition()
  const supabase = useMemo(() => createClient(), [])
  const [loadingStats, setLoadingStats] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<number>(0)
  const [stats, setStats] = useState<KpiStat[]>([
    { title: "Ventas del Día", value: "-", change: { value: 0, label: "cargando...", type: "increase" }, icon: Banknote, color: "green", href: "/dashboard/reports" },
    { title: "Órdenes Activas", value: "-", change: { value: 0, label: "cargando...", type: "increase" }, icon: ShoppingCart, color: "blue", href: "/dashboard/pos" },
    { title: "Clientes Nuevos", value: "-", change: { value: 0, label: "cargando...", type: "increase" }, icon: Users, color: "purple", href: "/dashboard/customers" },
    { title: "Productos Totales", value: "-", subtitle: "cargando...", icon: Package, color: "cyan", href: "/dashboard/products" },
    { title: "Stock Bajo", value: "-", subtitle: "cargando...", change: { value: 0, label: "", type: "decrease" }, icon: AlertTriangle, color: "orange", href: "/dashboard/products?filter=low_stock" },
    { title: "Reparaciones", value: "-", subtitle: "cargando...", icon: Activity, color: "red", href: "/dashboard/repairs" }
  ])

  const fetchDashboardStats = useCallback(async () => {
    if (!config.supabase.isConfigured) return
    setLoadingStats(true)
    try {
      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)

      // Build last 7 day dates for trend
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        d.setHours(0, 0, 0, 0)
        return d
      })

      // Parallel queries for better performance
      const [
        { data: salesToday },
        { count: activeOrdersCount },
        { count: newCustomersCount },
        { count: totalProductsCount },
        { data: productsStock },
        { count: repairsActiveCount },
        { data: salesWeek }
      ] = await Promise.all([
        supabase.from('sales').select('total:total_amount,status,created_at')
          .gte('created_at', startOfDay.toISOString()).lte('created_at', endOfDay.toISOString()),
        supabase.from('sales').select('id', { count: 'exact', head: true }).in('status', [...PENDING_SALE_STATUSES]),
        supabase.from('customers').select('id', { count: 'exact', head: true }).gte('created_at', startOfWeek.toISOString()),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('stock_quantity, min_stock').gt('stock_quantity', 0),
        supabase.from('repairs').select('id', { count: 'exact', head: true }).in('status', ['recibido', 'diagnostico', 'reparacion', 'listo']),
        supabase.from('sales').select('total_amount,created_at,status')
          .gte('created_at', last7Days[0].toISOString()).in('status', [...COMPLETED_SALE_STATUSES])
      ])

      type SaleRow = { total: number; status: string; created_at: string }
      const salesRows = (salesToday || []) as unknown as SaleRow[]
      const totalRevenueToday = salesRows
        .filter(s => isCompletedSaleStatus(s.status))
        .reduce((sum, s) => sum + (Number(s.total) || 0), 0)

      const activeOrders = activeOrdersCount || 0
      const newCustomers = newCustomersCount || 0
      const totalProducts = totalProductsCount || 0
      const repairsActive = repairsActiveCount || 0

      const lowStockCount = (productsStock || []).filter(p => {
        const sq = Number(p.stock_quantity ?? 0)
        const ms = Number(p.min_stock ?? 5)
        return sq <= ms
      }).length

      // Build 7-day trend
      type SalesWeekRow = { total_amount: number; created_at: string }
      const trendData = last7Days.map(dayStart => {
        const dayEnd = new Date(dayStart)
        dayEnd.setDate(dayEnd.getDate() + 1)
        const dayTotal = ((salesWeek || []) as unknown as SalesWeekRow[])
          .filter(s => {
            const t = new Date(s.created_at)
            return t >= dayStart && t < dayEnd
          })
          .reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0)
        return dayTotal
      })

      setStats([
        { title: "Ventas del Día", value: formatCurrency(totalRevenueToday), change: { value: 0, label: "en tiempo real", type: "increase" }, icon: Banknote, color: "green", href: "/dashboard/reports", trend: trendData },
        { title: "Órdenes Activas", value: String(activeOrders), change: { value: 0, label: "pendientes de pago", type: "increase" }, icon: ShoppingCart, color: "blue", href: "/dashboard/pos" },
        { title: "Clientes Nuevos", value: String(newCustomers), change: { value: 0, label: "últimos 7 días", type: "increase" }, icon: Users, color: "purple", href: "/dashboard/customers" },
        { title: "Productos Totales", value: String(totalProducts), subtitle: "En catálogo", icon: Package, color: "cyan", href: "/dashboard/products" },
        { title: "Stock Bajo", value: String(lowStockCount), subtitle: "Requiere atención", change: { value: 0, label: "", type: "decrease" }, icon: AlertTriangle, color: "orange", href: "/dashboard/products?filter=low_stock" },
        { title: "Reparaciones", value: String(repairsActive), subtitle: "En proceso", icon: Activity, color: "red", href: "/dashboard/repairs" }
      ])
      setLastRefresh(Date.now())
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    } finally {
      setLoadingStats(false)
    }
  }, [supabase])

  useEffect(() => {
    if (config.supabase.isConfigured) {
      startTransition(() => {
        fetchDashboardStats()
      })
    } else {
      setLoadingStats(false)
    }
  }, [fetchDashboardStats])

  const quickActions = [
    { title: "Nueva Venta", icon: ShoppingCart, href: "/dashboard/pos", color: "bg-blue-500 hover:bg-blue-600", description: "Registrar venta rápida" },
    { title: "Nueva Reparación", icon: Wrench, href: "/dashboard/repairs", color: "bg-amber-500 hover:bg-amber-600", description: "Crear orden de reparación" },
    { title: "Nuevo Cliente", icon: Users, href: "/dashboard/customers", color: "bg-purple-500 hover:bg-purple-600", description: "Registrar cliente" },
    { title: "Nuevo Producto", icon: Package, href: "/dashboard/products", color: "bg-emerald-500 hover:bg-emerald-600", description: "Agregar al inventario" },
    { title: "Ver Reportes", icon: BarChart3, href: "/dashboard/reports", color: "bg-indigo-500 hover:bg-indigo-600", description: "Análisis y métricas" }
  ]

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-blue-50/30 dark:from-[oklch(0.11_0.008_250)] dark:via-[oklch(0.13_0.009_248)] dark:to-[oklch(0.12_0.012_255)]">
      {/* Header Principal */}
      <div className="bg-white/50 dark:bg-transparent border-b border-gray-200/50 dark:border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">
                  Dashboard
                </h1>
                <Badge variant="outline" className="bg-linear-to-r from-blue-500 to-cyan-500 text-white border-0">
                  <Zap className="h-3 w-3 mr-1" />
                  En vivo
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-3 w-3" />
                {new Date().toLocaleDateString('es-ES', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                if (Date.now() - lastRefresh < 30_000) return
                startTransition(() => fetchDashboardStats())
              }}
              disabled={loadingStats || isPending || Date.now() - lastRefresh < 30_000}
              title={Date.now() - lastRefresh < 30_000 ? 'Espera 30 segundos entre actualizaciones' : undefined}
            >
              <RefreshCw className={`h-4 w-4 ${(loadingStats || isPending) ? 'animate-spin' : ''}`} />
              {loadingStats || isPending ? 'Actualizando...' : 'Actualizar'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* KPI Stats Grid - clickable with skeleton */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Métricas Clave</h2>
              <p className="text-sm text-muted-foreground">Click en cada métrica para ver detalles</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stats.map((stat) => (
              <KpiCard key={stat.title} stat={stat} loading={loadingStats} />
            ))}
          </div>
        </section>

        {/* Quick Actions + Recent Activity */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* Quick Actions */}
          <Card className="lg:col-span-1 border border-border/50 dark:border-white/[0.07] shadow-md dark:shadow-black/30 bg-white/80 dark:bg-white/[0.04] backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-500" />
                Acciones Rápidas
              </CardTitle>
              <CardDescription>Atajos para tareas comunes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickActions.map((action, idx) => (
                <Link
                  key={idx}
                  href={action.href}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-white text-sm font-medium transition-all ${action.color}`}
                >
                  <div className="p-1.5 rounded bg-white/20">
                    <action.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium text-sm">{action.title}</div>
                    <div className="text-xs opacity-80">{action.description}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="lg:col-span-2 border border-border/50 dark:border-white/[0.07] shadow-md dark:shadow-black/30 bg-white/80 dark:bg-white/[0.04] backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-green-500" />
                    Actividad Reciente
                  </CardTitle>
                  <CardDescription>Últimos movimientos del sistema</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="gap-2" asChild>
                  <Link href="/dashboard/reports">
                    Ver todo
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div className="space-y-3">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-14 rounded-xl"/>)}</div>}>
                <RecentActivityWithEmptyState />
              </Suspense>
            </CardContent>
          </Card>
        </div>

      </main>
    </div>
  )
}

// Wrapper that adds empty state and skeleton while RecentActivity loads
function RecentActivityWithEmptyState() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) {
    return (
      <div className="space-y-3">
        {Array.from({length: 4}).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
      </div>
    )
  }
  return (
    <Suspense fallback={
      <div className="space-y-3">
        {Array.from({length: 4}).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
      </div>
    }>
      <RecentActivity />
    </Suspense>
  )
}

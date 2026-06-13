"use client"

import { Suspense, useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ShoppingCart,
  Users,
  Package,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Zap,
  Activity,
  BarChart3,
  RefreshCw,
  Banknote,
  Wrench,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  ExternalLink,
  Boxes,
  Receipt,
  ClipboardList,
  Store,
  Globe,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { config } from '@/lib/config'
import { useBranch } from '@/contexts/branch-context'
import { withBranchFilter } from '@/lib/branches/client'
import { formatCurrency } from '@/lib/currency'
import { COMPLETED_SALE_STATUSES, PENDING_SALE_STATUSES, isCompletedSaleStatus } from '@/lib/sales-status'
import { cn } from '@/lib/utils'

// Dynamic imports
const RecentActivity = dynamic(
  () => import('@/components/dashboard/stats-overview').then(m => m.RecentActivity),
  { ssr: false }
)

// ---------------------------------------------------------------------------
// Mini sparkline
// ---------------------------------------------------------------------------

function MiniSparkline({ data, color = '#6366f1' }: { data: number[]; color?: string }) {
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
  const areaPoints = `0,${h} ${points} ${w},${h}`
  const gradientId = `spark-${color.replace('#', '')}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-20 sm:w-24" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon fill={`url(#${gradientId})`} points={areaPoints} />
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Hero metric
// ---------------------------------------------------------------------------

type Tone = 'indigo' | 'emerald' | 'violet' | 'amber' | 'red' | 'cyan'

interface KpiStat {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  tone: Tone
  href: string
  trend?: number[]
  badge?: string
}

const toneClasses: Record<Tone, { wrap: string; iconBg: string; sparkColor: string }> = {
  indigo:  { wrap: 'from-indigo-500/10 to-transparent border-indigo-200/50 dark:border-indigo-900/50',     iconBg: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',   sparkColor: '#6366f1' },
  emerald: { wrap: 'from-emerald-500/10 to-transparent border-emerald-200/50 dark:border-emerald-900/50', iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', sparkColor: '#10b981' },
  violet:  { wrap: 'from-violet-500/10 to-transparent border-violet-200/50 dark:border-violet-900/50',    iconBg: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',    sparkColor: '#8b5cf6' },
  amber:   { wrap: 'from-amber-500/10 to-transparent border-amber-200/50 dark:border-amber-900/50',       iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',       sparkColor: '#f59e0b' },
  red:     { wrap: 'from-red-500/10 to-transparent border-red-200/50 dark:border-red-900/50',             iconBg: 'bg-red-500/15 text-red-600 dark:text-red-400',             sparkColor: '#ef4444' },
  cyan:    { wrap: 'from-cyan-500/10 to-transparent border-cyan-200/50 dark:border-cyan-900/50',          iconBg: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',          sparkColor: '#06b6d4' },
}

function KpiCard({ stat, loading }: { stat: KpiStat; loading: boolean }) {
  const t = toneClasses[stat.tone]
  if (loading) {
    return (
      <div className={cn('overflow-hidden rounded-2xl border bg-gradient-to-br p-5', t.wrap)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-8 w-32" />
            <Skeleton className="mt-1.5 h-3 w-20" />
          </div>
          <Skeleton className="h-11 w-11 rounded-xl" />
        </div>
      </div>
    )
  }
  return (
    <Link href={stat.href} className="group block">
      <div className={cn('relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 transition-all hover:shadow-md', t.wrap)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{stat.title}</p>
              {stat.badge && (
                <Badge variant="outline" className="rounded-full text-[10px] px-1.5 h-4">
                  {stat.badge}
                </Badge>
              )}
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{stat.value}</p>
            {stat.subtitle && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{stat.subtitle}</p>
            )}
          </div>
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', t.iconBg)}>
            <stat.icon className="h-5 w-5" />
          </div>
        </div>
        {stat.trend && stat.trend.length > 1 && (
          <div className="mt-3 flex justify-end">
            <MiniSparkline data={stat.trend} color={t.sparkColor} />
          </div>
        )}
        <ArrowUpRight className="absolute right-3 top-3 h-3.5 w-3.5 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [isPending, startTransition] = useTransition()
  const supabase = useMemo(() => createClient(), [])
  const { selectedBranchId } = useBranch()
  const [loadingStats, setLoadingStats] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<number>(-Infinity)
  const [orgSlug, setOrgSlug] = useState<string | null>(null)
  const [stats, setStats] = useState<KpiStat[]>([
    { title: 'Ventas del día', value: '—', icon: Banknote, tone: 'emerald', href: '/dashboard/reports' },
    { title: 'Órdenes activas', value: '—', icon: ShoppingCart, tone: 'indigo', href: '/dashboard/pos' },
    { title: 'Clientes nuevos', value: '—', icon: Users, tone: 'violet', href: '/dashboard/customers' },
    { title: 'Productos', value: '—', icon: Package, tone: 'cyan', href: '/dashboard/products' },
    { title: 'Stock bajo', value: '—', icon: AlertTriangle, tone: 'amber', href: '/dashboard/products?filter=low_stock' },
    { title: 'Reparaciones', value: '—', icon: Wrench, tone: 'red', href: '/dashboard/repairs' },
  ])

  const fetchDashboardStats = useCallback(async () => {
    if (!config.supabase.isConfigured) return
    setLoadingStats(true)
    try {
      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)

      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        d.setHours(0, 0, 0, 0)
        return d
      })

      const [
        { data: salesToday },
        { count: activeOrdersCount },
        { count: newCustomersCount },
        { count: totalProductsCount },
        { data: productsStock },
        { count: repairsActiveCount },
        { data: salesWeek },
      ] = await Promise.all([
        withBranchFilter(
          supabase.from('sales').select('total:total_amount,status,created_at')
            .gte('created_at', startOfDay.toISOString()).lte('created_at', endOfDay.toISOString()),
          selectedBranchId,
        ),
        withBranchFilter(
          supabase.from('sales').select('id', { count: 'exact', head: true }).in('status', [...PENDING_SALE_STATUSES]),
          selectedBranchId,
        ),
        supabase.from('customers').select('id', { count: 'exact', head: true }).gte('created_at', startOfWeek.toISOString()),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('stock_quantity, min_stock').gt('stock_quantity', 0),
        withBranchFilter(
          supabase.from('repairs').select('id', { count: 'exact', head: true }).in('status', ['recibido', 'diagnostico', 'reparacion', 'listo']),
          selectedBranchId,
        ),
        withBranchFilter(
          supabase.from('sales').select('total_amount,created_at,status')
            .gte('created_at', last7Days[0].toISOString()).in('status', [...COMPLETED_SALE_STATUSES]),
          selectedBranchId,
        ),
      ])

      type SaleRow = { total: number; status: string; created_at: string }
      const salesRows = (salesToday || []) as unknown as SaleRow[]
      const totalRevenueToday = salesRows
        .filter(s => isCompletedSaleStatus(s.status))
        .reduce((sum, s) => sum + (Number(s.total) || 0), 0)
      const completedToday = salesRows.filter(s => isCompletedSaleStatus(s.status)).length

      const activeOrders = activeOrdersCount || 0
      const newCustomers = newCustomersCount || 0
      const totalProducts = totalProductsCount || 0
      const repairsActive = repairsActiveCount || 0

      const lowStockCount = (productsStock || []).filter(p => {
        const sq = Number(p.stock_quantity ?? 0)
        const ms = Number(p.min_stock ?? 5)
        return sq > 0 && sq <= ms
      }).length

      type SalesWeekRow = { total_amount: number; created_at: string }
      const trendData = last7Days.map(dayStart => {
        const dayEnd = new Date(dayStart)
        dayEnd.setDate(dayEnd.getDate() + 1)
        return ((salesWeek || []) as unknown as SalesWeekRow[])
          .filter(s => {
            const t = new Date(s.created_at)
            return t >= dayStart && t < dayEnd
          })
          .reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0)
      })
      const customerTrend = last7Days.map(() => Math.floor(Math.random() * (newCustomers + 1)))

      setStats([
        {
          title: 'Ventas del día',
          value: formatCurrency(totalRevenueToday),
          subtitle: `${completedToday} venta${completedToday !== 1 ? 's' : ''} completada${completedToday !== 1 ? 's' : ''}`,
          icon: Banknote, tone: 'emerald', href: '/dashboard/reports',
          trend: trendData,
        },
        {
          title: 'Órdenes activas',
          value: String(activeOrders),
          subtitle: 'pendientes de pago',
          icon: ShoppingCart, tone: 'indigo', href: '/dashboard/pos',
          badge: activeOrders > 0 ? 'Atender' : undefined,
        },
        {
          title: 'Clientes nuevos',
          value: String(newCustomers),
          subtitle: 'últimos 7 días',
          icon: Users, tone: 'violet', href: '/dashboard/customers',
          trend: customerTrend,
        },
        {
          title: 'Productos',
          value: String(totalProducts),
          subtitle: 'en catálogo activo',
          icon: Package, tone: 'cyan', href: '/dashboard/products',
        },
        {
          title: 'Stock bajo',
          value: String(lowStockCount),
          subtitle: lowStockCount > 0 ? 'requiere reposición' : 'inventario OK',
          icon: AlertTriangle, tone: lowStockCount > 0 ? 'amber' : 'emerald', href: '/dashboard/products?filter=low_stock',
          badge: lowStockCount > 0 ? '⚠' : undefined,
        },
        {
          title: 'Reparaciones',
          value: String(repairsActive),
          subtitle: 'en proceso',
          icon: Wrench, tone: 'red', href: '/dashboard/repairs',
        },
      ])
      setLastRefresh(Date.now())
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    } finally {
      setLoadingStats(false)
    }
  }, [selectedBranchId, supabase])

  useEffect(() => {
    if (config.supabase.isConfigured) {
      startTransition(() => fetchDashboardStats())
    } else {
      setLoadingStats(false)
    }
  }, [fetchDashboardStats])

  // Load organization slug for store link
  useEffect(() => {
    if (!config.supabase.isConfigured) return
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('organization_members')
        .select('organizations!inner(slug)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          const org = data?.organizations as any
          const slug = Array.isArray(org) ? org[0]?.slug : org?.slug
          if (slug) setOrgSlug(slug)
        })
    })
  }, [supabase])

  const quickActions = [
    { title: 'Nueva venta', icon: ShoppingCart, href: '/dashboard/pos', tone: 'indigo' as const },
    { title: 'Nueva reparación', icon: Wrench, href: '/dashboard/repairs?new=true', tone: 'amber' as const },
    { title: 'Nuevo cliente', icon: Users, href: '/dashboard/customers', tone: 'violet' as const },
    { title: 'Nuevo producto', icon: Package, href: '/dashboard/products', tone: 'emerald' as const },
    { title: 'Ver reportes', icon: BarChart3, href: '/dashboard/reports', tone: 'cyan' as const },
    { title: 'Mi tienda pública', icon: Store, href: orgSlug ? `/${orgSlug}/inicio` : '/marketplace/empresas', tone: 'emerald' as const },
    { title: 'Marketplace', icon: Globe, href: '/marketplace', tone: 'cyan' as const },
  ]

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 19) return 'Buenas tardes'
    return 'Buenas noches'
  })()

  const today = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const secondsSinceRefresh = Math.max(0, Math.floor((Date.now() - lastRefresh) / 1000))
  const canRefresh = secondsSinceRefresh >= 30

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">

      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Activity className="h-3.5 w-3.5" />
            Centro operativo
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
              {greeting}
            </h1>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              En vivo
            </span>
          </div>
          <p className="text-sm capitalize text-slate-500 dark:text-slate-400">{today}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/dashboard/reports">
              <BarChart3 className="h-3.5 w-3.5" />
              Reportes
            </Link>
          </Button>
          <Button asChild size="sm" className="gap-2">
            <Link href="/dashboard/pos">
              <Plus className="h-3.5 w-3.5" />
              Nueva venta
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="gap-2 bg-amber-500 text-slate-950 hover:bg-amber-400"
          >
            <Link href="/dashboard/repairs?new=true">
              <Wrench className="h-3.5 w-3.5" />
              Nueva reparación
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              if (!canRefresh) return
              startTransition(() => fetchDashboardStats())
            }}
            disabled={loadingStats || isPending || !canRefresh}
            title={!canRefresh ? 'Esperá 30s entre actualizaciones' : undefined}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', (loadingStats || isPending) && 'animate-spin')} />
            Actualizar
          </Button>
        </div>
      </header>

      {/* KPI grid */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <KpiCard key={stat.title} stat={stat} loading={loadingStats} />
        ))}
      </section>

      {/* Actions + Activity */}
      <section className="grid gap-4 lg:grid-cols-[0.4fr_0.6fr]">

        {/* Quick actions */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-900/50 dark:bg-indigo-950/20 dark:text-indigo-400">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Acciones rápidas</CardTitle>
                <p className="mt-0.5 text-xs text-slate-500">Atajos para tareas comunes</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {quickActions.map((action) => {
              const t = toneClasses[action.tone]
              const Icon = action.icon
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group flex items-center gap-3 rounded-lg border bg-card p-3 transition-all hover:border-slate-300 hover:bg-slate-50 dark:hover:border-slate-600 dark:hover:bg-slate-800/40"
                >
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', t.iconBg)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="flex-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {action.title}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-300 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )
            })}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-400">
                  <Activity className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Actividad reciente</CardTitle>
                  <p className="mt-0.5 text-xs text-slate-500">Últimos movimientos del sistema</p>
                </div>
              </div>
              <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                <Link href="/dashboard/reports">
                  Ver todo
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Suspense fallback={
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
              </div>
            }>
              <RecentActivityWithEmptyState />
            </Suspense>
          </CardContent>
        </Card>
      </section>

      {/* Quick links footer */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { href: '/dashboard/pos', icon: ShoppingCart, label: 'Punto de venta', sub: 'POS y cobros' },
          { href: '/dashboard/products', icon: Boxes, label: 'Inventario', sub: 'Catálogo y stock' },
          { href: '/dashboard/orders', icon: Receipt, label: 'Órdenes', sub: 'Historial y estado' },
          { href: '/dashboard/customers', icon: ClipboardList, label: 'Clientes', sub: 'CRM y contactos' },
          { href: '/marketplace', icon: Globe, label: 'Marketplace', sub: 'Explorar empresas y productos' },
          { href: orgSlug ? `/${orgSlug}/inicio` : '/marketplace/empresas', icon: Store, label: 'Mi tienda pública', sub: 'Ver cómo te ven los clientes' },
        ].map(({ href, icon: Icon, label, sub }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:hover:border-slate-600 dark:hover:bg-slate-800/50"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</p>
              <p className="truncate text-xs text-slate-400">{sub}</p>
            </div>
            <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-300" />
          </Link>
        ))}
      </section>
    </div>
  )
}

// Wrapper that adds empty state and skeleton while RecentActivity loads
function RecentActivityWithEmptyState() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0)
    return () => clearTimeout(t)
  }, [])
  if (!mounted) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
      </div>
    )
  }
  return (
    <Suspense fallback={
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
      </div>
    }>
      <RecentActivity />
    </Suspense>
  )
}

"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
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
  Plus,
  ExternalLink,
  Boxes,
  Receipt,
  ClipboardList,
  Store,
  Globe,
  RotateCcw,
  PackageCheck,
  CheckCircle2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { config } from '@/lib/config'
import { useBranch } from '@/contexts/branch-context'
import { withBranchFilter } from '@/lib/branches/client'
import { formatCurrency } from '@/lib/currency'
import { COMPLETED_SALE_STATUSES, isCompletedSaleStatus } from '@/lib/sales-status'
import { ACTIVE_REPAIR_STATUSES } from '@/lib/constants/repair-status'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { HelpButton } from '@/components/help/HelpButton'
import { useAuth } from '@/contexts/auth-context'
import { useCashRegister } from '@/hooks/useCashRegister'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'

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

interface KpiBreakdownItem {
  label: string
  count: number | string
  icon?: LucideIcon
}

interface KpiStat {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  tone: Tone
  href: string
  trend?: number[]
  badge?: string
  breakdown?: KpiBreakdownItem[]
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
        {stat.breakdown && stat.breakdown.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
            {stat.breakdown.map((item, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-white/70 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border border-slate-200/70 dark:border-slate-700/70 shadow-2xs"
              >
                {item.icon && <item.icon className="h-3 w-3 text-slate-500 dark:text-slate-400" />}
                <strong className="font-bold text-slate-900 dark:text-slate-100">{item.count}</strong>
                <span className="text-slate-500 dark:text-slate-400">{item.label}</span>
              </span>
            ))}
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
  const { effectiveModules } = useSubscriptionStatus()
  const hasRepairs = effectiveModules.includes('repairs')
  const hasOrders = effectiveModules.includes('orders')
  const hasServices = effectiveModules.includes('services')
  const [isPending, startTransition] = useTransition()
  const supabase = useMemo(() => createClient(), [])
  const { selectedBranchId } = useBranch()
  const [loadingStats, setLoadingStats] = useState(true)
  const [canRefresh, setCanRefresh] = useState(true)
  const refreshCooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [orgSlug, setOrgSlug] = useState<string | null>(null)
  const [stats, setStats] = useState<KpiStat[]>([
    { title: 'Ventas del día', value: '—', icon: Banknote, tone: 'emerald', href: '/dashboard/reports' },
    ...(hasOrders ? [{ title: 'Órdenes activas', value: '—', icon: ShoppingCart, tone: 'indigo' as const, href: '/dashboard/orders' }] : []),
    { title: 'Clientes nuevos', value: '—', icon: Users, tone: 'violet', href: '/dashboard/customers' },
    { title: 'Productos', value: '—', icon: Package, tone: 'cyan', href: '/dashboard/products' },
    { title: 'Stock bajo', value: '—', icon: AlertTriangle, tone: 'amber', href: '/dashboard/products?filter=low_stock' },
    ...(hasRepairs ? [{ title: 'Reparaciones', value: '—', icon: Wrench, tone: 'red' as const, href: '/dashboard/repairs' }] : []),
  ])

  const [repairStats, setRepairStats] = useState<{
    todayCount: number
    todayAmount: number
    deliveredCount: number
    deliveredAmount: number
    readyCount: number
    readyAmount: number
  }>({
    todayCount: 0,
    todayAmount: 0,
    deliveredCount: 0,
    deliveredAmount: 0,
    readyCount: 0,
    readyAmount: 0,
  })

  // Caja / Cash Register integration
  const { user } = useAuth()
  const {
    currentSession,
    checkOpenSession,
    openRegister: hookOpenRegister,
    closeRegister: hookCloseRegister,
    loading: registerLoading,
  } = useCashRegister()

  const [activeRegisterId, setActiveRegisterId] = useState<string>('')
  const [isOpenRegisterDialogOpen, setIsOpenRegisterDialogOpen] = useState(false)
  const [openingAmount, setOpeningAmount] = useState('')
  const [openingNote, setOpeningNote] = useState('')
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false)
  const [closingCountedAmount, setClosingCountedAmount] = useState('')

  // Sync active register with branch & localstorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    const storageKey = `pos_active_register_id:${selectedBranchId || 'unscoped'}`
    const saved = localStorage.getItem(storageKey) || localStorage.getItem('pos_active_register_id') || 'principal'
    setActiveRegisterId(saved)
  }, [selectedBranchId])

  // Check open session
  useEffect(() => {
    checkOpenSession(activeRegisterId || undefined)
  }, [activeRegisterId, selectedBranchId, checkOpenSession])

  const parsedOpeningAmount = useMemo(() => {
    const n = Number(openingAmount)
    return Number.isFinite(n) && n >= 0 ? n : 0
  }, [openingAmount])

  const isOpeningAmountValid = parsedOpeningAmount > 0

  const parsedClosingAmount = useMemo(() => {
    const n = Number(closingCountedAmount)
    return Number.isFinite(n) && n >= 0 ? n : null
  }, [closingCountedAmount])

  const expectedBalance = useMemo(() => {
    if (!currentSession) return 0
    return currentSession.movements.reduce((sum, mov) => {
      if (mov.type === 'opening' || mov.type === 'sale' || mov.type === 'cash_in') {
        return sum + mov.amount
      } else if (mov.type === 'cash_out') {
        return sum - mov.amount
      }
      return sum
    }, 0)
  }, [currentSession])

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
        { data: customersWeek },
        { data: productsData },
        { data: categoriesData },
        { count: repairsActiveCount },
        { data: salesWeek },
        { data: repairsTodayData },
        { data: repairsDeliveredData },
        { data: repairsReadyData },
      ] = await Promise.all([
        withBranchFilter(
          supabase.from('sales').select('total:total_amount,status,created_at')
            .gte('created_at', startOfDay.toISOString()).lte('created_at', endOfDay.toISOString()),
          selectedBranchId,
        ),
        hasOrders ? withBranchFilter(
          supabase
            .from('customer_orders')
            .select('id', { count: 'exact', head: true })
            .in('status', ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SHIPPED']),
          selectedBranchId,
        ) : Promise.resolve({ count: 0, data: [] }),
        supabase.from('customers').select('created_at').gte('created_at', startOfWeek.toISOString()),
        supabase.from('products').select('id, stock_quantity, min_stock, unit_measure, category_id').eq('is_active', true),
        supabase.from('categories').select('id, name').eq('is_active', true),
        hasRepairs ? withBranchFilter(
          // Fuente única de "en proceso": incluye pausado y excluye listo
          // (listo = reparación terminada, esperando retiro).
          supabase.from('repairs').select('id', { count: 'exact', head: true }).in('status', [...ACTIVE_REPAIR_STATUSES]),
          selectedBranchId,
        ) : Promise.resolve({ count: 0, data: [] }),
        withBranchFilter(
          supabase.from('sales').select('total_amount,created_at,status')
            .gte('created_at', last7Days[0].toISOString()).in('status', [...COMPLETED_SALE_STATUSES]),
          selectedBranchId,
        ),
        // Reparaciones ingresadas hoy
        hasRepairs ? withBranchFilter(
          supabase.from('repairs').select('final_cost, estimated_cost, paid_amount, status, created_at')
            .gte('created_at', startOfDay.toISOString()).lte('created_at', endOfDay.toISOString()),
          selectedBranchId,
        ) : Promise.resolve({ data: [] }),
        // Reparaciones entregadas hoy
        hasRepairs ? withBranchFilter(
          supabase.from('repairs').select('final_cost, estimated_cost, paid_amount, status, delivered_at')
            .or(`delivered_at.gte.${startOfDay.toISOString()},status.eq.entregado`),
          selectedBranchId,
        ) : Promise.resolve({ data: [] }),
        // Reparaciones listas para retiro
        hasRepairs ? withBranchFilter(
          supabase.from('repairs').select('final_cost, estimated_cost, paid_amount')
            .eq('status', 'listo'),
          selectedBranchId,
        ) : Promise.resolve({ data: [] }),
      ])

      type RepairItem = { final_cost?: number | null; estimated_cost?: number | null; paid_amount?: number | null; status?: string; delivered_at?: string | null; created_at?: string }

      const todayList = (repairsTodayData || []) as unknown as RepairItem[]
      const todayCount = todayList.length
      const todayAmount = todayList.reduce((sum, r) => sum + (Number(r.final_cost ?? r.estimated_cost ?? 0) || 0), 0)

      const deliveredRaw = (repairsDeliveredData || []) as unknown as RepairItem[]
      const deliveredTodayList = deliveredRaw.filter(r => {
        if (!r.delivered_at) return r.status === 'entregado'
        const d = new Date(r.delivered_at)
        return d >= startOfDay && d <= endOfDay
      })
      const deliveredCount = deliveredTodayList.length
      const deliveredAmount = deliveredTodayList.reduce((sum, r) => sum + (Number(r.final_cost ?? r.estimated_cost ?? r.paid_amount ?? 0) || 0), 0)

      const readyList = (repairsReadyData || []) as unknown as RepairItem[]
      const readyCount = readyList.length
      const readyAmount = readyList.reduce((sum, r) => sum + (Number(r.final_cost ?? r.estimated_cost ?? 0) || 0), 0)

      setRepairStats({
        todayCount,
        todayAmount,
        deliveredCount,
        deliveredAmount,
        readyCount,
        readyAmount,
      })

      type SaleRow = { total: number; status: string; created_at: string }
      const salesRows = (salesToday || []) as unknown as SaleRow[]
      const totalRevenueToday = salesRows
        .filter(s => isCompletedSaleStatus(s.status))
        .reduce((sum, s) => sum + (Number(s.total) || 0), 0)
      const completedToday = salesRows.filter(s => isCompletedSaleStatus(s.status)).length

      const activeOrders = activeOrdersCount || 0
      const customerRows = (customersWeek || []) as unknown as Array<{ created_at: string }>
      const newCustomers = customerRows.length

      // Diferenciación de Productos físicos vs Servicios
      type ProductRow = { id: string; stock_quantity?: number | null; min_stock?: number | null; unit_measure?: string | null; category_id?: string | null }
      type CategoryRow = { id: string; name: string }

      const productRows = (productsData || []) as unknown as ProductRow[]
      const categoryList = (categoriesData || []) as unknown as CategoryRow[]

      const serviceCategoryIds = new Set(
        categoryList
          .filter(c => (c.name || '').toLowerCase().includes('servicio'))
          .map(c => c.id)
      )

      const servicesList = hasServices ? productRows.filter(p => {
        const isServiceUnit = (p.unit_measure || '').toLowerCase() === 'servicio'
        const isServiceCat = Boolean(p.category_id && serviceCategoryIds.has(p.category_id))
        return isServiceUnit || isServiceCat
      }) : []
      const servicesCount = servicesList.length

      const physicalProducts = productRows.filter(p => {
        const isServiceUnit = (p.unit_measure || '').toLowerCase() === 'servicio'
        const isServiceCat = Boolean(p.category_id && serviceCategoryIds.has(p.category_id))
        return !isServiceUnit && !isServiceCat
      })
      const physicalProductsCount = physicalProducts.length
      const totalCatalogCount = hasServices ? productRows.length : physicalProductsCount

      const repairsActive = repairsActiveCount || 0

      // Stock bajo aplica exclusivamente a productos físicos con control de inventario
      const lowStockCount = physicalProducts.filter(p => {
        const sq = Number(p.stock_quantity ?? 0)
        const ms = Number(p.min_stock ?? 5)
        return sq <= ms
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
      const customerTrend = last7Days.map(dayStart => {
        const dayEnd = new Date(dayStart)
        dayEnd.setDate(dayEnd.getDate() + 1)
        return customerRows.filter(c => {
          const t = new Date(c.created_at)
          return t >= dayStart && t < dayEnd
        }).length
      })

      const nextStats: KpiStat[] = [
        {
          title: 'Ventas del día',
          value: formatCurrency(totalRevenueToday),
          subtitle: `${completedToday} venta${completedToday !== 1 ? 's' : ''} completada${completedToday !== 1 ? 's' : ''}`,
          icon: Banknote, tone: 'emerald' as const, href: '/dashboard/reports',
          trend: trendData,
        },
        ...(hasOrders ? [{
          title: 'Órdenes activas',
          value: String(activeOrders),
          subtitle: 'pedidos por completar',
          icon: ShoppingCart, tone: 'indigo' as const, href: '/dashboard/orders',
          badge: activeOrders > 0 ? 'Atender' : undefined,
        }] : []),
        {
          title: 'Clientes nuevos',
          value: String(newCustomers),
          subtitle: 'últimos 7 días',
          icon: Users, tone: 'violet' as const, href: '/dashboard/customers',
          trend: customerTrend,
        },
        {
          title: 'Catálogo / Inventario',
          value: String(totalCatalogCount),
          subtitle: hasServices
            ? `${physicalProductsCount} productos · ${servicesCount} servicios`
            : `${physicalProductsCount} productos`,
          icon: Package, tone: 'cyan' as const, href: '/dashboard/products',
          breakdown: [
            { label: 'Productos', count: physicalProductsCount, icon: Package },
            ...(hasServices ? [{ label: 'Servicios', count: servicesCount, icon: Wrench }] : []),
          ],
        },
        {
          title: 'Stock bajo',
          value: String(lowStockCount),
          subtitle: lowStockCount > 0 ? 'requiere reposición' : 'inventario OK',
          icon: AlertTriangle, tone: lowStockCount > 0 ? 'amber' as const : 'emerald' as const, href: '/dashboard/products?filter=low_stock',
          badge: lowStockCount > 0 ? '⚠' : undefined,
        },
        ...(hasRepairs ? [{
          title: 'Reparaciones',
          value: String(repairsActive),
          subtitle: 'en proceso',
          icon: Wrench, tone: 'red' as const, href: '/dashboard/repairs',
        }] : []),
      ]
      setStats(nextStats)
      // Cooldown de 30s: el timeout re-habilita el botón sin depender de otro render.
      setCanRefresh(false)
      if (refreshCooldownRef.current) clearTimeout(refreshCooldownRef.current)
      refreshCooldownRef.current = setTimeout(() => setCanRefresh(true), 30_000)
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    } finally {
      setLoadingStats(false)
    }
  }, [hasOrders, hasRepairs, hasServices, selectedBranchId, supabase])

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
          const org = data?.organizations as { slug?: string } | { slug?: string }[] | null
          const slug = Array.isArray(org) ? org[0]?.slug : org?.slug
          if (slug) setOrgSlug(slug)
        })
    })
  }, [supabase])

  const quickActions = [
    { title: 'Nueva venta', icon: ShoppingCart, href: '/dashboard/pos', tone: 'indigo' as const },
    ...(hasRepairs ? [{ title: 'Nueva reparación', icon: Wrench, href: '/dashboard/repairs?new=true', tone: 'amber' as const }] : []),
    { title: 'Nueva devolución', icon: RotateCcw, href: '/dashboard/after-sales?new=true', tone: 'violet' as const },
    { title: 'Nuevo cliente', icon: Users, href: '/dashboard/customers?new=true', tone: 'violet' as const },
    { title: 'Nuevo producto', icon: Package, href: '/dashboard/products?new=true', tone: 'emerald' as const },
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

  useEffect(() => () => {
    if (refreshCooldownRef.current) clearTimeout(refreshCooldownRef.current)
  }, [])

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
        <div className="flex flex-wrap gap-2 items-center">
          {/* Botón dinámico de Caja (Llamativo y cambia de color) */}
          {currentSession ? (
            <Button
              onClick={() => {
                setClosingCountedAmount('')
                setIsCloseDialogOpen(true)
              }}
              disabled={registerLoading}
              type="button"
              className="gap-2 h-10 px-5 text-sm font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20 border-0 transition-all duration-300 transform hover:scale-[1.02]"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-300"></span>
              </span>
              Caja Abierta (Cerrar)
            </Button>
          ) : (
            <Button
              onClick={() => {
                setOpeningAmount('')
                setOpeningNote('')
                setIsOpenRegisterDialogOpen(true)
              }}
              disabled={registerLoading}
              type="button"
              className="gap-2 h-10 px-5 text-sm font-bold bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-lg shadow-red-500/20 border-0 transition-all duration-300 transform hover:scale-[1.02] animate-pulse"
            >
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-200"></span>
              </span>
              Abrir Caja
            </Button>
          )}

          <Button asChild size="sm" className="gap-2">
            <Link href="/dashboard/pos">
              <Plus className="h-3.5 w-3.5" />
              Nueva venta
            </Link>
          </Button>
          {hasRepairs ? <Button
            asChild
            size="sm"
            className="gap-2 bg-amber-500 text-slate-950 hover:bg-amber-400"
          >
            <Link href="/dashboard/repairs?new=true">
              <Wrench className="h-3.5 w-3.5" />
              Nueva reparación
            </Link>
          </Button> : null}
          <Button
            asChild
            size="sm"
            className="gap-2 bg-purple-600 text-white hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-500"
          >
            <Link href="/dashboard/after-sales?new=true">
              <RotateCcw className="h-3.5 w-3.5" />
              Nueva devolución
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              if (!canRefresh) return
              startTransition(() => {
                fetchDashboardStats()
                if (activeRegisterId) {
                  checkOpenSession(activeRegisterId).catch(() => {})
                }
              })
            }}
            disabled={loadingStats || isPending || !canRefresh}
            title={!canRefresh ? 'Esperá 30s entre actualizaciones' : undefined}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', (loadingStats || isPending) && 'animate-spin')} />
            Actualizar
          </Button>
          <HelpButton guideKey="overview" variant="outline" size="sm" className="gap-2" showLabel />
        </div>
      </header>

      {/* KPI grid */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <KpiCard key={stat.title} stat={stat} loading={loadingStats} />
        ))}
      </section>

      {/* Resumen Financiero de Reparaciones del Día */}
      {hasRepairs ? <section className="rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50/90 via-orange-50/40 to-amber-50/50 p-5 shadow-sm dark:border-amber-900/40 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-amber-950/30">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200/60 pb-3.5 dark:border-amber-900/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm dark:bg-amber-600">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Resumen Financiero de Reparaciones
                </h2>
                <Badge variant="outline" className="border-amber-300 bg-amber-100/80 text-amber-900 dark:border-amber-800 dark:bg-amber-900/50 dark:text-amber-200 text-[10px] font-bold">
                  Hoy
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Montos por reparaciones ingresadas, equipos entregados y listos para retiro
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs border-amber-300 bg-white/80 hover:bg-amber-100 dark:border-amber-800 dark:bg-slate-900 dark:hover:bg-amber-950/40">
            <Link href="/dashboard/repairs">
              Ver Taller
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {/* Card 1: Monto por reparaciones ingresadas hoy */}
          <div className="flex flex-col justify-between rounded-xl border border-white/80 bg-white/95 p-4 shadow-sm transition-all hover:shadow-md dark:border-white/10 dark:bg-[#0d1117]/90">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Monto Ingresado Hoy
                </p>
                <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                  {loadingStats ? <Skeleton className="h-7 w-28" /> : formatCurrency(repairStats.todayAmount)}
                </div>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Wrench className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 border-t border-slate-100 pt-2.5 dark:border-slate-800">
              <span className="font-bold text-slate-800 dark:text-slate-200">{repairStats.todayCount}</span> orden{repairStats.todayCount !== 1 ? 'es' : ''} ingresada{repairStats.todayCount !== 1 ? 's' : ''} hoy
            </p>
          </div>

          {/* Card 2: Monto de reparaciones entregadas hoy */}
          <div className="flex flex-col justify-between rounded-xl border border-white/80 bg-white/95 p-4 shadow-sm transition-all hover:shadow-md dark:border-white/10 dark:bg-[#0d1117]/90">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Entregadas Hoy
                </p>
                <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                  {loadingStats ? <Skeleton className="h-7 w-28" /> : formatCurrency(repairStats.deliveredAmount)}
                </div>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <PackageCheck className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 border-t border-slate-100 pt-2.5 dark:border-slate-800">
              <span className="font-bold text-slate-800 dark:text-slate-200">{repairStats.deliveredCount}</span> equipo{repairStats.deliveredCount !== 1 ? 's' : ''} retirado{repairStats.deliveredCount !== 1 ? 's' : ''} hoy
            </p>
          </div>

          {/* Card 3: Monto listo para retiro */}
          <div className="flex flex-col justify-between rounded-xl border border-white/80 bg-white/95 p-4 shadow-sm transition-all hover:shadow-md dark:border-white/10 dark:bg-[#0d1117]/90">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                  Lista p/ Retiro
                </p>
                <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                  {loadingStats ? <Skeleton className="h-7 w-28" /> : formatCurrency(repairStats.readyAmount)}
                </div>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 border-t border-slate-100 pt-2.5 dark:border-slate-800">
              <span className="font-bold text-slate-800 dark:text-slate-200">{repairStats.readyCount}</span> listo{repairStats.readyCount !== 1 ? 's' : ''} esperando retiro
            </p>
          </div>
        </div>
      </section> : null}

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
          ...(hasOrders ? [{ href: '/dashboard/orders', icon: Receipt, label: 'Órdenes', sub: 'Historial y estado' }] : []),
          { href: '/dashboard/customers', icon: ClipboardList, label: 'Clientes', sub: 'CRM y contactos' },
          { href: '/dashboard/after-sales', icon: RotateCcw, label: 'Posventa y Devoluciones', sub: 'Garantías y reclamos' },
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

      {/* Dialogs for Cash Register Control */}
      <Dialog open={isOpenRegisterDialogOpen} onOpenChange={setIsOpenRegisterDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Abrir Caja</DialogTitle>
            <DialogDescription>
              Ingrese el monto inicial en caja para comenzar el turno.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Monto Inicial (Gs)</Label>
              <Input
                id="amount"
                type="number"
                inputMode="decimal"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
                placeholder="0"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="note">Nota (Opcional)</Label>
              <Input
                id="note"
                value={openingNote}
                onChange={(e) => setOpeningNote(e.target.value)}
                placeholder="Ej. Turno mañana"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setIsOpenRegisterDialogOpen(false)}>Cancelar</Button>
            <Button
              disabled={!isOpeningAmountValid || registerLoading}
              type="button"
              onClick={async () => {
                const ok = await hookOpenRegister(activeRegisterId, parsedOpeningAmount, user?.id, openingNote)
                if (ok) {
                  setIsOpenRegisterDialogOpen(false)
                  setOpeningAmount('')
                  setOpeningNote('')
                }
              }}
            >
              {registerLoading ? 'Abriendo...' : 'Abrir Caja'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCloseDialogOpen} onOpenChange={(open) => {
        setIsCloseDialogOpen(open)
        if (!open) setClosingCountedAmount('')
      }}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Cerrar Caja</DialogTitle>
            <DialogDescription>
              Registre el monto físico contado en caja para calcular diferencias.
            </DialogDescription>
          </DialogHeader>

          {currentSession && (
            <div className="rounded-lg border bg-muted/40 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Apertura:</span>
                <span className="font-semibold">
                  {new Intl.NumberFormat('es-PY').format(currentSession.opening_balance)} Gs.
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ventas registradas:</span>
                <span className="font-semibold text-emerald-600">
                  +{new Intl.NumberFormat('es-PY').format(
                    currentSession.movements.filter(m => m.type === 'sale').reduce((s, m) => s + m.amount, 0)
                  )} Gs.
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ingresos (Varios):</span>
                <span className="font-semibold text-emerald-600">
                  +{new Intl.NumberFormat('es-PY').format(
                    currentSession.movements.filter(m => m.type === 'cash_in').reduce((s, m) => s + m.amount, 0)
                  )} Gs.
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Egresos:</span>
                <span className="font-semibold text-rose-600">
                  -{new Intl.NumberFormat('es-PY').format(
                    currentSession.movements.filter(m => m.type === 'cash_out').reduce((s, m) => s + m.amount, 0)
                  )} Gs.
                </span>
              </div>
              <div className="h-px bg-border my-2" />
              <div className="flex justify-between font-bold">
                <span>Esperado en caja:</span>
                <span className="text-blue-700 dark:text-blue-400">
                  {new Intl.NumberFormat('es-PY').format(expectedBalance)} Gs.
                </span>
              </div>
              {parsedClosingAmount !== null && (
                <div className={`flex justify-between font-bold ${
                  parsedClosingAmount === expectedBalance
                    ? 'text-emerald-600'
                    : 'text-amber-600'
                }`}>
                  <span>Diferencia:</span>
                  <span>
                    {parsedClosingAmount > expectedBalance ? '+' : ''}
                    {new Intl.NumberFormat('es-PY').format(parsedClosingAmount - expectedBalance)} Gs.
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="closing-counted">Monto real contado en caja (Gs)</Label>
            <Input
              id="closing-counted"
              type="number"
              inputMode="decimal"
              value={closingCountedAmount}
              onChange={(e) => setClosingCountedAmount(e.target.value)}
              placeholder={`Ej: ${new Intl.NumberFormat('es-PY').format(expectedBalance)}`}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Cuente el efectivo físico de la caja y anote el monto final aquí.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => {
              setIsCloseDialogOpen(false)
              setClosingCountedAmount('')
            }}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={parsedClosingAmount === null || registerLoading}
              type="button"
              onClick={async () => {
                if (parsedClosingAmount === null) return
                const ok = await hookCloseRegister(parsedClosingAmount, user?.id)
                if (ok) {
                  setIsCloseDialogOpen(false)
                  setClosingCountedAmount('')
                }
              }}
            >
              {registerLoading ? 'Cerrando...' : 'Confirmar Cierre'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

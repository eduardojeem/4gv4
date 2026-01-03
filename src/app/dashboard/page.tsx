"use client"

import { Suspense, useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatsCard } from '@/components/shared'
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
  Banknote
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { config } from '@/lib/config'
import { formatCurrency } from '@/lib/currency'

// Dynamic imports optimized for Next.js

const QuickNav = dynamic(
  () => import('@/components/dashboard/quick-nav').then(m => m.QuickNav),
  { ssr: false }
)

const RecentActivity = dynamic(
  () => import('@/components/dashboard/stats-overview').then(m => m.RecentActivity),
  { ssr: false }
)

export default function DashboardPage() {
  const [isPending, startTransition] = useTransition()
  const supabase = useMemo(() => createClient(), [])
  const [loadingStats, setLoadingStats] = useState(false)
  const [stats, setStats] = useState<Array<{
    title: string
    value: string | number
    subtitle?: string
    change?: { value: number; label: string; type: 'increase' | 'decrease' }
    icon: LucideIcon
    color: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan'
  }>>([
    { title: "Ventas del Día", value: "-", change: { value: 0, label: "cargando...", type: "increase" }, icon: Banknote, color: "green" },
    { title: "Órdenes Activas", value: "-", change: { value: 0, label: "cargando...", type: "increase" }, icon: ShoppingCart, color: "blue" },
    { title: "Clientes Nuevos", value: "-", change: { value: 0, label: "cargando...", type: "increase" }, icon: Users, color: "purple" },
    { title: "Productos Totales", value: "-", subtitle: "cargando...", icon: Package, color: "cyan" },
    { title: "Stock Bajo", value: "-", subtitle: "cargando...", change: { value: 0, label: "", type: "decrease" }, icon: AlertTriangle, color: "orange" },
    { title: "Reparaciones", value: "-", subtitle: "cargando...", icon: Activity, color: "red" }
  ])

  const fetchDashboardStats = useCallback(async () => {
    if (!config.supabase.isConfigured) return
    setLoadingStats(true)
    try {
      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)

      // Parallel queries for better performance
      const [
        { data: salesToday, error: salesError },
        { count: activeOrdersCount, error: ordersError },
        { count: newCustomersCount, error: customersError },
        { count: totalProductsCount, error: productsCountError },
        { data: productsStock, error: productsStockError },
        { count: repairsActiveCount, error: repairsError }
      ] = await Promise.all([
        // Sales today
        supabase
          .from('sales')
          .select('total:total_amount,status,created_at')
          .gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString()),
        
        // Active orders count
        supabase
          .from('sales')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pendiente'),
          
        // New customers this week
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startOfWeek.toISOString()),
          
        // Total products count
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true }),
          
        // Products for low stock calculation (optimized to fetch only needed fields)
        supabase
          .from('products')
          .select('stock_quantity, min_stock')
          .gt('stock_quantity', 0), // Only fetch items with stock to check if they are low

        // Active repairs count
        supabase
          .from('repairs')
          .select('id', { count: 'exact', head: true })
          .in('status', ['recibido', 'diagnostico', 'reparacion', 'listo'])
      ])

      if (salesError) throw salesError
      if (ordersError) throw ordersError
      if (customersError) throw customersError
      if (productsCountError) throw productsCountError
      if (productsStockError) throw productsStockError
      if (repairsError) throw repairsError

      type SaleRow = { total: number; status: 'pendiente' | 'completada' | 'cancelada'; created_at: string }
      const salesRows = (salesToday || []) as unknown as SaleRow[]
      const totalRevenueToday = salesRows
        .filter(s => s.status === 'completada')
        .reduce((sum, s) => sum + (Number(s.total) || 0), 0)

      const activeOrders = activeOrdersCount || 0
      const newCustomers = newCustomersCount || 0
      const totalProducts = totalProductsCount || 0
      const repairsActive = repairsActiveCount || 0

      // Calculate low stock on client side (until we have an RPC for this)
      const lowStockCount = (productsStock || []).filter(p => {
        const sq = Number(p.stock_quantity ?? 0)
        const ms = Number(p.min_stock ?? 5)
        return sq <= ms
      }).length

      const nextStats = [
        {
          title: "Ventas del Día",
          value: formatCurrency(totalRevenueToday),
          change: { value: 0, label: "en tiempo real", type: "increase" as const },
          icon: Banknote,
          color: "green" as const
        },
        {
          title: "Órdenes Activas",
          value: String(activeOrders),
          change: { value: 0, label: "pendientes", type: "increase" as const },
          icon: ShoppingCart,
          color: "blue" as const
        },
        {
          title: "Clientes Nuevos",
          value: String(newCustomers),
          change: { value: 0, label: "últimos 7 días", type: "increase" as const },
          icon: Users,
          color: "purple" as const
        },
        {
          title: "Productos Totales",
          value: String(totalProducts),
          subtitle: "En catálogo",
          icon: Package,
          color: "cyan" as const
        },
        {
          title: "Stock Bajo",
          value: String(lowStockCount),
          subtitle: "Requiere atención",
          change: { value: 0, label: "", type: "decrease" as const },
          icon: AlertTriangle,
          color: "orange" as const
        },
        {
          title: "Reparaciones",
          value: String(repairsActive),
          subtitle: "En proceso",
          icon: Activity,
          color: "red" as const
        }
      ]

      setStats(nextStats)
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
      // Optionally set error state or show toast
    } finally {
      setLoadingStats(false)
    }
  }, [supabase])

  useEffect(() => {
    if (config.supabase.isConfigured) {
      startTransition(() => {
        fetchDashboardStats()
      })
    }
  }, [fetchDashboardStats])

  const quickActions = [
    { title: "Nueva Venta", icon: ShoppingCart, href: "/dashboard/pos", color: "bg-blue-500", description: "Registrar venta rápida" },
    { title: "Nuevo Producto", icon: Package, href: "/dashboard/products", color: "bg-green-500", description: "Agregar al inventario" },
    { title: "Nuevo Cliente", icon: Users, href: "/dashboard/customers", color: "bg-purple-500", description: "Registrar cliente" },
    { title: "Ver Reportes", icon: BarChart3, href: "/dashboard/reports", color: "bg-orange-500", description: "Análisis y métricas" }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-blue-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950/20">
      {/* Header Premium */}
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border-b border-gray-200/50 dark:border-gray-700/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 dark:from-gray-100 dark:via-gray-200 dark:to-gray-300 bg-clip-text text-transparent">
                  Dashboard
                </h1>
                <Badge variant="outline" className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0">
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
              onClick={() => startTransition(() => fetchDashboardStats())}
              disabled={loadingStats || isPending}
            >
              <RefreshCw className="h-4 w-4" />
              {loadingStats || isPending ? 'Actualizando...' : 'Actualizar'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* KPI Stats Grid */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Métricas Clave</h2>
              <p className="text-sm text-muted-foreground">Resumen de rendimiento en tiempo real</p>
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {stats.map((stat, index) => (
              <StatsCard key={index} {...stat} />
            ))}
          </div>
        </section>

        {/* Acciones Rápidas + Actividad Reciente */}
        <div className="grid gap-6 lg:grid-cols-3">

          {/* Quick Actions */}
          <Card className="lg:col-span-1 border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-500" />
                Acciones Rápidas
              </CardTitle>
              <CardDescription>Atajos para tareas comunes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {quickActions.map((action, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  className="w-full justify-start group hover:shadow-md transition-all"
                  asChild
                >
                  <a href={action.href}>
                    <div className={`p-2 rounded-lg ${action.color} text-white mr-3`}>
                      <action.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">{action.title}</div>
                      <div className="text-xs text-muted-foreground">{action.description}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="lg:col-span-2 border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-green-500" />
                    Actividad Reciente
                  </CardTitle>
                  <CardDescription>Últimos movimientos del sistema</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="gap-2">
                  Ver todo
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<Skeleton className="h-48" />}>
                <RecentActivity />
              </Suspense>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Cards */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Navegación Rápida</h2>
              <p className="text-sm text-muted-foreground">Accede a las secciones principales</p>
            </div>
          </div>
          <Suspense fallback={
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          }>
            <QuickNav />
          </Suspense>
        </section>

      </main>
    </div>
  )
}

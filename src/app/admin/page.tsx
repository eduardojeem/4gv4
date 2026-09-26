'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FinanceSnapshot } from '@/components/admin/finances/FinanceSnapshot'
import { SalesChart } from '@/components/dashboard/sales-chart'
import { RepairsChart } from '@/components/dashboard/repairs-chart'
import { useRepairs } from '@/contexts/RepairsContext'
import { useAuth } from '@/contexts/auth-context'
import { useBranch } from '@/contexts/branch-context'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import { useAdminOverviewMetrics } from '@/hooks/use-admin-overview-metrics'
import { useAdminNavBadges } from '@/hooks/use-admin-nav-badges'
import { formatCurrency } from '@/lib/currency'
import {
  adminNavCategories,
  filterCategoriesByPermissions,
  type NavItem,
} from '@/config/admin-navigation'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight, LayoutDashboard,
  Monitor,
  Package,
  RefreshCw,
  Settings, TrendingUp,
  Users,
  WalletCards,
  Wrench,
  type LucideIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'

type MetricTone = 'neutral' | 'urgent' | 'positive' | 'warning' | 'info'

const METRIC_TONE: Record<MetricTone, { border: string; icon: string; bg: string }> = {
  neutral: { border: 'border-l-blue-500', icon: 'text-blue-500', bg: 'bg-blue-50/50 dark:bg-blue-950/20' },
  urgent: { border: 'border-l-destructive', icon: 'text-destructive', bg: 'bg-destructive/5' },
  positive: { border: 'border-l-emerald-500', icon: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50/50 dark:bg-emerald-950/20' },
  warning: { border: 'border-l-amber-500', icon: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50/50 dark:bg-amber-950/20' },
  info: { border: 'border-l-violet-500', icon: 'text-violet-500', bg: 'bg-violet-50/50 dark:bg-violet-950/20' },
}

function StatCard({
  label,
  value,
  secondary,
  icon: Icon,
  tone,
  href,
  badgeText,
}: {
  label: string
  value: string | number
  secondary?: string
  icon: LucideIcon
  tone: MetricTone
  href?: string
  badgeText?: string
}) {
  const toneStyle = METRIC_TONE[tone]
  const content = (
    <Card className={cn('border-l-4 shadow-sm transition-all duration-200 hover:shadow-md', toneStyle.border, href && 'cursor-pointer hover:border-primary/50')}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground tabular-nums truncate">
              {value}
            </p>
            {secondary ? (
              <p className="mt-1 text-xs text-muted-foreground truncate">{secondary}</p>
            ) : null}
          </div>
          <div className={cn('rounded-lg p-2 shrink-0', toneStyle.bg)}>
            <Icon className={cn('h-5 w-5', toneStyle.icon)} aria-hidden="true" />
          </div>
        </div>
        {badgeText ? (
          <div className="mt-2.5">
            <Badge
              variant={tone === 'urgent' ? 'destructive' : 'outline'}
              className="text-[10px] font-medium"
            >
              {badgeText}
            </Badge>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )

  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl">
        {content}
      </Link>
    )
  }

  return content
}

export default function AdminHome() {
  const { repairs, isLoading: repairsLoading, error: repairsError, refreshRepairs } = useRepairs()
  const { effectiveModules } = useSubscriptionStatus()
  const hasRepairs = effectiveModules.includes('repairs')
  const { user, hasPermission, isAdmin, isSuperAdmin } = useAuth()
  const { selectedBranch } = useBranch()
  const { metrics: overviewMetrics, loading: overviewLoading, refresh: refreshOverview } = useAdminOverviewMetrics()
  const navBadges = useAdminNavBadges()
  const [activeTab, setActiveTab] = useState('overview')
  const [isRefreshingAll, setIsRefreshingAll] = useState(false)

  // Real-time metrics from repairs data
  const repairMetrics = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const active = repairs.filter(r => !['entregado', 'cancelado'].includes(r.status || ''))
    const urgent = repairs.filter(r => r.urgency === 'urgent' && !['entregado', 'cancelado'].includes(r.status || ''))
    const todayRepairs = repairs.filter(r => new Date(r.createdAt) >= today)
    const pending = repairs.filter(r => r.status === 'recibido')

    return {
      totalActive: active.length,
      urgent: urgent.length,
      today: todayRepairs.length,
      pending: pending.length,
    }
  }, [repairs])

  // Las tarjetas de navegación salen de la misma configuración que usa el menú
  // lateral, filtrada por permisos: así el panel no puede quedar desfasado del
  // menú ni ofrecer secciones a las que el usuario no tiene acceso.
  const navCategories = useMemo(
    () => filterCategoriesByPermissions(adminNavCategories, hasPermission, isAdmin, isSuperAdmin, effectiveModules),
    [hasPermission, isAdmin, isSuperAdmin, effectiveModules],
  )

  // "Resumen" es esta misma página: no tiene sentido enlazarla desde acá.
  const sections = useMemo(
    () => navCategories
      .map(category => ({
        ...category,
        items: category.items.filter(item => (
          item.href
          && item.href !== '/admin'
          && (hasRepairs || (!item.href.startsWith('/dashboard/repairs') && !item.href.startsWith('/dashboard/technician')))
        )),
      }))
      .filter(category => category.items.length > 0),
    [hasRepairs, navCategories],
  )

  // El resumen financiero se consulta contra la organización activa
  const canSeeFinances = isAdmin || hasPermission('finances.read')
  const branchScope = selectedBranch?.name ?? 'Todas las sucursales'
  const cashAlertsCount = navBadges['cash-alerts'] ?? 0

  const handleRefreshAll = async () => {
    setIsRefreshingAll(true)
    try {
      const promises: Promise<unknown>[] = [refreshOverview()]
      if (hasRepairs) {
        promises.push(Promise.resolve(refreshRepairs()))
      }
      await Promise.allSettled(promises)
    } finally {
      setIsRefreshingAll(false)
    }
  }

  const isLoading = (repairsLoading && repairs.length === 0) || overviewLoading
  const hasUrgentAttention = cashAlertsCount > 0 || (hasRepairs && repairMetrics.urgent > 0) || overviewMetrics.lowStockCount > 0

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Panel de Administración
            </h1>
            <Badge variant="secondary" className="font-normal text-xs capitalize">
              {user?.role || 'Admin'}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Control central operativo y financiero · {user?.profile?.name || user?.email || 'Administrador'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1.5 py-1 px-2.5 font-normal text-muted-foreground border-border/80">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <span>{branchScope}</span>
          </Badge>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleRefreshAll()}
            disabled={isRefreshingAll}
            aria-busy={isRefreshingAll}
            className="gap-1.5 shadow-sm"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isRefreshingAll && 'animate-spin')} aria-hidden="true" />
            {isRefreshingAll ? 'Actualizando…' : 'Actualizar'}
          </Button>
        </div>
      </div>

      {/* Quick Action Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-1 shrink-0">
          Accesos Rápidos:
        </span>
        <Button asChild variant="secondary" size="sm" className="h-8 gap-1.5 text-xs font-medium shrink-0 rounded-full">
          <Link href="/admin/cash-monitor">
            <Monitor className="h-3.5 w-3.5" />
            Monitor de Cajas
            {cashAlertsCount > 0 ? (
              <span className="ml-1 rounded-full bg-destructive px-1.5 py-0.2 text-[10px] text-destructive-foreground font-bold">
                {cashAlertsCount}
              </span>
            ) : null}
          </Link>
        </Button>
        {canSeeFinances ? (
          <Button asChild variant="secondary" size="sm" className="h-8 gap-1.5 text-xs font-medium shrink-0 rounded-full">
            <Link href="/admin/finances">
              <WalletCards className="h-3.5 w-3.5" />
              Finanzas & Gastos
            </Link>
          </Button>
        ) : null}
        <Button asChild variant="secondary" size="sm" className="h-8 gap-1.5 text-xs font-medium shrink-0 rounded-full">
          <Link href="/admin/inventory">
            <Package className="h-3.5 w-3.5" />
            Inventario & Stock
            {overviewMetrics.lowStockCount > 0 ? (
              <span className="ml-1 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 text-[10px] font-bold">
                {overviewMetrics.lowStockCount}
              </span>
            ) : null}
          </Link>
        </Button>
        <Button asChild variant="secondary" size="sm" className="h-8 gap-1.5 text-xs font-medium shrink-0 rounded-full">
          <Link href="/admin/users">
            <Users className="h-3.5 w-3.5" />
            Usuarios
          </Link>
        </Button>
        <Button asChild variant="secondary" size="sm" className="h-8 gap-1.5 text-xs font-medium shrink-0 rounded-full">
          <Link href="/admin/settings">
            <Settings className="h-3.5 w-3.5" />
            Configuración
          </Link>
        </Button>
      </div>

      {/* Actionable Attention Banner */}
      {hasUrgentAttention ? (
        <Card className="border-amber-400/40 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-950/20 shadow-sm">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Puntos operativos que requieren tu atención
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {cashAlertsCount > 0 ? (
                    <Badge variant="destructive" className="font-normal text-xs">
                      {cashAlertsCount} {cashAlertsCount === 1 ? 'alerta de caja' : 'alertas de caja'} sin resolver
                    </Badge>
                  ) : null}
                  {hasRepairs && repairMetrics.urgent > 0 ? (
                    <Badge variant="destructive" className="font-normal text-xs">
                      {repairMetrics.urgent} {repairMetrics.urgent === 1 ? 'reparación urgente' : 'reparaciones urgentes'}
                    </Badge>
                  ) : null}
                  {overviewMetrics.lowStockCount > 0 ? (
                    <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300 font-normal text-xs">
                      {overviewMetrics.lowStockCount} {overviewMetrics.lowStockCount === 1 ? 'producto con stock bajo' : 'productos con stock bajo'}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              {cashAlertsCount > 0 ? (
                <Button asChild size="sm" variant="default" className="gap-1">
                  <Link href="/admin/cash-monitor">
                    Resolver Cajas
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : overviewMetrics.lowStockCount > 0 ? (
                <Button asChild size="sm" variant="outline" className="gap-1">
                  <Link href="/admin/inventory">
                    Revisar Stock
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30 text-xs text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Operación al día: no hay alertas críticas de cajas ni stock agotado en esta sucursal.</span>
        </div>
      )}

      {/* Error Card if repairs fail */}
      {hasRepairs && repairsError ? (
        <Card role="alert" className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  No pudimos cargar las reparaciones
                </p>
                <p className="text-sm text-muted-foreground">
                  Los indicadores del taller pueden estar desactualizados. {repairsError.message}
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void refreshRepairs()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Balanced Executive KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true" aria-label="Cargando métricas">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-[102px] w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Ventas de Hoy"
            value={formatCurrency(overviewMetrics.todaySalesTotal)}
            secondary={`${overviewMetrics.todaySalesCount} operaciones`}
            icon={TrendingUp}
            tone="positive"
            href="/admin/analytics"
          />

          <StatCard
            label="Monitor de Cajas"
            value={`${overviewMetrics.openCashRegisters} abiertas`}
            secondary={cashAlertsCount > 0 ? `${cashAlertsCount} alertas pendientes` : 'Arqueos en regla'}
            icon={Monitor}
            tone={cashAlertsCount > 0 ? 'urgent' : 'neutral'}
            badgeText={cashAlertsCount > 0 ? 'Atención requerida' : undefined}
            href="/admin/cash-monitor"
          />

          {hasRepairs ? (
            <StatCard
              label="Taller / Reparaciones"
              value={`${repairMetrics.totalActive} en curso`}
              secondary={repairMetrics.urgent > 0 ? `${repairMetrics.urgent} urgentes sin entregar` : `${repairMetrics.today} recibidas hoy`}
              icon={Wrench}
              tone={repairMetrics.urgent > 0 ? 'urgent' : 'info'}
              badgeText={repairMetrics.urgent > 0 ? `${repairMetrics.urgent} urgentes` : undefined}
              href="/dashboard/repairs"
            />
          ) : (
            <StatCard
              label="Equipo Activo"
              value={`${overviewMetrics.activeUsersCount} usuarios`}
              secondary="Miembros activos de esta organización"
              icon={Users}
              tone="info"
              href="/admin/users"
            />
          )}

          <StatCard
            label="Inventario en Riesgo"
            value={`${overviewMetrics.lowStockCount} items`}
            secondary={overviewMetrics.lowStockCount > 0 ? 'Bajo stock mínimo' : 'Stock en niveles óptimos'}
            icon={Package}
            tone={overviewMetrics.lowStockCount > 0 ? 'warning' : 'positive'}
            badgeText={overviewMetrics.lowStockCount > 0 ? 'Reposición sugerida' : undefined}
            href="/admin/inventory"
          />
        </div>
      )}

      {/* Tabs: Organized Executive Sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between border-b pb-2">
          <TabsList className="bg-muted/60 p-1">
            <TabsTrigger value="overview" className="text-xs sm:text-sm font-medium gap-1.5">
              <LayoutDashboard className="h-4 w-4" />
              Panorama General
            </TabsTrigger>
            <TabsTrigger value="modules" className="text-xs sm:text-sm font-medium gap-1.5">
              <Package className="h-4 w-4" />
              Módulos y Gestión
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: Panorama General (Finanzas y Tendencias) */}
        <TabsContent value="overview" className="space-y-6 m-0 focus-visible:outline-none">
          {/* Finanzas de la organización */}
          {canSeeFinances ? <FinanceSnapshot /> : null}

          {/* Tendencias y Gráficos */}
          <section className="space-y-3" aria-labelledby="admin-trends-title">
            <div className="flex items-center justify-between">
              <h2 id="admin-trends-title" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tendencias Operativas
              </h2>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {hasRepairs ? (
                <Card className="min-w-0 border shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Ventas</CardTitle>
                    <CardDescription>Tendencia semanal</CardDescription>
                  </CardHeader>
                  <CardContent className="min-w-0">
                    <SalesChart />
                  </CardContent>
                </Card>
              ) : null}

              <Card className="min-w-0 border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Reparaciones</CardTitle>
                  <CardDescription>Distribución por estado</CardDescription>
                </CardHeader>
                <CardContent className="min-w-0">
                  <RepairsChart />
                </CardContent>
              </Card>
            </div>
          </section>
        </TabsContent>

        {/* TAB 2: Módulos y Gestión del Sistema */}
        <TabsContent value="modules" className="space-y-6 m-0 focus-visible:outline-none">
          {sections.map((category) => (
            <section key={category.id} className="space-y-3" aria-labelledby={`admin-section-${category.id}`}>
              <div className="flex items-center gap-2">
                <h2
                  id={`admin-section-${category.id}`}
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {category.label}
                </h2>
                <span className="text-xs text-muted-foreground/60 font-normal">
                  ({category.items.length} {category.items.length === 1 ? 'módulo' : 'módulos'})
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {category.items.map((item: NavItem) => {
                  const Icon = item.icon
                  const hasBadge = item.badge ? (navBadges[item.badge] ?? 0) > 0 : false
                  const badgeValue = item.badge ? navBadges[item.badge] ?? 0 : 0

                  return (
                    <Link
                      key={item.key}
                      href={item.href as string}
                      className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <Card className="h-full border transition-all duration-200 hover:border-primary/40 hover:bg-muted/40 hover:shadow-sm">
                        <CardContent className="flex items-center gap-3.5 p-4">
                          <div className="rounded-xl bg-primary/10 p-3 text-primary transition-all duration-200 group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground shrink-0">
                            <Icon className="h-5 w-5" aria-hidden="true" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                                {item.label}
                              </h3>
                              {hasBadge ? (
                                <Badge variant="destructive" className="h-4 px-1 text-[9px] font-bold">
                                  {badgeValue}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="truncate text-xs text-muted-foreground mt-0.5">
                              {item.description}
                            </p>
                          </div>
                          <ChevronRight
                            className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-1 group-hover:text-foreground"
                            aria-hidden="true"
                          />
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            </section>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}

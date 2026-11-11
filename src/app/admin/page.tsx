'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { FinanceSnapshot } from '@/components/admin/finances/FinanceSnapshot'
import { SalesChart } from '@/components/dashboard/sales-chart'
import { RepairsChart } from '@/components/dashboard/repairs-chart'
import { useRepairs } from '@/contexts/RepairsContext'
import { useAuth } from '@/contexts/auth-context'
import { useBranch } from '@/contexts/branch-context'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import { useAdminOverviewMetrics } from '@/hooks/use-admin-overview-metrics'
import { useAdminNavBadges } from '@/hooks/use-admin-nav-badges'
import { adminNavCategories, filterCategoriesByPermissions, type NavItem } from '@/config/admin-navigation'
import { formatCurrency } from '@/lib/currency'
import { normalizeText } from '@/lib/text/normalize'
import { cn } from '@/lib/utils'
import {
  AlertTriangle, ArrowRight, Building2, CheckCircle2, ChevronRight, LayoutDashboard,
  Monitor, Package, RefreshCw, Search, TrendingUp, Users, Wrench, X, type LucideIcon,
} from 'lucide-react'

type MetricTone = 'neutral' | 'urgent' | 'positive' | 'warning' | 'info'
const METRIC_TONE: Record<MetricTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  urgent: 'bg-destructive/10 text-destructive',
  positive: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  info: 'bg-primary/10 text-primary',
}

function StatCard({ label, value, secondary, scope, icon: Icon, tone = 'neutral', href }: {
  label: string; value: string | number | null; secondary: string; scope: string
  icon: LucideIcon; tone?: MetricTone; href?: string
}) {
  const content = (
    <Card className={cn('h-full gap-0 rounded-2xl border shadow-none transition-colors', href && 'group-hover:border-primary/40 group-hover:bg-muted/20')}>
      <CardContent className="flex h-full flex-col gap-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <span className={cn('rounded-xl p-2', METRIC_TONE[value === null ? 'neutral' : tone])}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('break-words font-semibold tracking-tight tabular-nums', value === null ? 'text-lg text-muted-foreground' : 'text-2xl sm:text-3xl')}>
            {value ?? 'No disponible'}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{value === null ? 'Reintentá para consultar este indicador.' : secondary}</p>
        </div>
        <div className="flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
          <span className="min-w-0 break-words">{scope}</span>
          {href ? <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /> : null}
        </div>
      </CardContent>
    </Card>
  )
  return href ? <Link href={href} className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{content}</Link> : content
}

export default function AdminHome() {
  const { repairs, isLoading: repairsLoading, error: repairsError, refreshRepairs } = useRepairs()
  const { effectiveModules } = useSubscriptionStatus()
  const hasRepairs = effectiveModules.includes('repairs')
  const { user, hasPermission, isAdmin, isSuperAdmin } = useAuth()
  const { selectedBranch, selectedBranchId } = useBranch()
  const navBadges = useAdminNavBadges()
  const [activeTab, setActiveTab] = useState('overview')
  const [moduleFilter, setModuleFilter] = useState('')
  const [isRefreshingAll, setIsRefreshingAll] = useState(false)
  const navCategories = useMemo(
    () => filterCategoriesByPermissions(adminNavCategories, hasPermission, isAdmin, isSuperAdmin, effectiveModules),
    [hasPermission, isAdmin, isSuperAdmin, effectiveModules],
  )
  const allowedRoutes = new Set(navCategories.flatMap(category => category.items.map(item => item.href)))
  const canSeeSales = allowedRoutes.has('/admin/analytics')
  const canSeeFinances = allowedRoutes.has('/admin/finances')
  const canSeeInventory = allowedRoutes.has('/admin/inventory')
  const canSeeCashMonitor = allowedRoutes.has('/admin/cash-monitor')
  const canSeeUsers = allowedRoutes.has('/admin/users')
  const canSeeRepairs = hasRepairs && (isAdmin || hasPermission('repairs.read'))
  const { metrics: overviewMetrics, loading: overviewLoading, error: overviewError, updatedAt, refresh: refreshOverview } = useAdminOverviewMetrics({
    sales: canSeeSales, cash: canSeeCashMonitor, inventory: canSeeInventory, team: canSeeUsers && !canSeeRepairs,
  })
  const branchScope = selectedBranch?.name ?? (selectedBranchId && selectedBranchId !== 'all' ? 'Sucursal seleccionada' : 'Todas las sucursales')
  const cashAlertsCount = overviewMetrics.cashAlertsCount
  const repairMetrics = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const active = repairs.filter(repair => !['entregado', 'cancelado'].includes(repair.status))
    return { active: active.length, urgent: active.filter(repair => repair.urgency === 'urgent').length, today: repairs.filter(repair => new Date(repair.createdAt) >= today).length }
  }, [repairs])
  const sections = useMemo(() => navCategories.map(category => ({
    ...category, items: category.items.filter(item => item.href && item.href !== '/admin'),
  })).filter(category => category.items.length > 0), [navCategories])
  const filteredSections = useMemo(() => {
    const query = normalizeText(moduleFilter)
    return sections.map(category => ({ ...category, items: category.items.filter(item =>
      !query || normalizeText(`${category.label} ${item.label} ${item.description} ${item.href}`).includes(query),
    ) })).filter(category => category.items.length > 0)
  }, [sections, moduleFilter])
  const quickLinks = sections.flatMap(category => category.items).filter(item =>
    ['/admin/cash-monitor', '/admin/finances', '/admin/inventory', '/admin/users', '/admin/settings'].includes(item.href ?? ''),
  )
  const handleRefreshAll = async () => {
    setIsRefreshingAll(true)
    try { await Promise.allSettled([refreshOverview(), ...(canSeeRepairs ? [refreshRepairs()] : [])]) }
    finally { setIsRefreshingAll(false) }
  }
  const isLoading = overviewLoading || (canSeeRepairs && repairsLoading)
  const hasUrgentAttention = (canSeeCashMonitor && (cashAlertsCount ?? 0) > 0)
    || (canSeeInventory && (overviewMetrics.lowStockCount ?? 0) > 0)
    || (canSeeRepairs && !repairsError && repairMetrics.urgent > 0)
  const attentionUnavailable = Boolean(overviewError || (canSeeRepairs && repairsError))
    || (canSeeCashMonitor && cashAlertsCount === null) || (canSeeInventory && overviewMetrics.lowStockCount === null)
  const hasOperationalChecks = canSeeCashMonitor || canSeeInventory || canSeeRepairs

  return (
    <div className="space-y-6 pb-4">
      <header className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Administración</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Resumen del negocio</h1>
          <p className="text-sm text-muted-foreground">Hola, {user?.profile?.name || 'administrador'}. Revisá la actividad y elegí qué gestionar.</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="h-auto max-w-full gap-1.5 whitespace-normal py-1 font-normal">
              <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{branchScope}
            </Badge>
            <span>{isLoading ? 'Consultando datos…' : updatedAt ? `Última consulta: ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Esperando la organización activa'}</span>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={() => void handleRefreshAll()} disabled={isRefreshingAll || isLoading} aria-busy={isRefreshingAll} className="shrink-0 gap-2 self-start sm:self-center">
          <RefreshCw className={cn('h-4 w-4', isRefreshingAll && 'animate-spin')} aria-hidden="true" />
          {isRefreshingAll ? 'Actualizando…' : 'Actualizar resumen'}
        </Button>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl bg-muted/60 p-1 sm:w-fit">
          <TabsTrigger value="overview" className="gap-2 whitespace-normal px-3 py-2 text-xs sm:text-sm"><LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" />Panorama General</TabsTrigger>
          <TabsTrigger value="modules" className="gap-2 whitespace-normal px-3 py-2 text-xs sm:text-sm"><Package className="h-4 w-4 shrink-0" aria-hidden="true" />Módulos y Gestión</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="m-0 space-y-7">
          <section aria-labelledby="admin-attention" className="space-y-3">
            <h2 id="admin-attention" className="text-base font-semibold">Necesita atención</h2>
            <Card className={cn('gap-0 rounded-2xl shadow-none', hasUrgentAttention && 'border-amber-500/30 bg-amber-500/5')}>
              <CardContent className="space-y-3 p-4 sm:p-5">
                {isLoading ? <p role="status" className="text-sm text-muted-foreground">Estamos comprobando los indicadores del negocio…</p> : hasUrgentAttention ? (
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    <div className="space-y-2 text-sm">
                      {canSeeCashMonitor && (cashAlertsCount ?? 0) > 0 ? <Link href="/admin/cash-monitor" className="flex items-center gap-2 font-medium underline-offset-4 hover:underline">{cashAlertsCount} alertas de caja pendientes <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link> : null}
                      {canSeeInventory && (overviewMetrics.lowStockCount ?? 0) > 0 ? <Link href="/admin/inventory" className="flex items-center gap-2 font-medium underline-offset-4 hover:underline">{overviewMetrics.lowStockCount} productos en el mínimo de stock o por debajo <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link> : null}
                      {canSeeRepairs && !repairsError && repairMetrics.urgent > 0 ? <Link href="/dashboard/repairs" className="flex items-center gap-2 font-medium underline-offset-4 hover:underline">{repairMetrics.urgent} reparaciones urgentes sin entregar <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link> : null}
                    </div>
                  </div>
                ) : !attentionUnavailable && hasOperationalChecks ? (
                  <div className="flex items-start gap-3 text-sm"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" /><div><p className="font-medium">Sin alertas en los indicadores consultados</p><p className="mt-1 text-xs text-muted-foreground">Alcance: {branchScope}. Consultá cada sección para ver el detalle.</p></div></div>
                ) : <p className="text-sm text-muted-foreground">{attentionUnavailable ? 'La comprobación está incompleta. Reintentá los indicadores que no se pudieron cargar.' : 'Las herramientas disponibles para tu cuenta están en Módulos y Gestión.'}</p>}
                {overviewError ? <div role="alert" className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm">{overviewError} Los datos sin confirmar figuran como “No disponible”.</p><Button type="button" variant="outline" size="sm" disabled={isRefreshingAll} onClick={() => void handleRefreshAll()} className="shrink-0">Reintentar indicadores</Button></div> : null}
                {canSeeRepairs && repairsError ? <div role="alert" className="flex flex-col gap-3 rounded-xl border border-destructive/20 p-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm">No pudimos cargar las reparaciones. El indicador del taller no está disponible.</p><Button type="button" variant="outline" size="sm" onClick={() => void refreshRepairs()}>Reintentar reparaciones</Button></div> : null}
              </CardContent>
            </Card>
          </section>

          <section aria-labelledby="admin-activity" className="space-y-3">
            <div><h2 id="admin-activity" className="text-base font-semibold">Actividad de hoy</h2><p className="mt-1 text-xs text-muted-foreground">Ventas de hoy según la hora de tu dispositivo. Cajas, taller e inventario muestran el estado actual.</p></div>
            {isLoading ? <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4" aria-busy="true" aria-label="Cargando indicadores">{[0, 1, 2, 3].map(key => <Skeleton key={key} className="h-44 rounded-2xl" />)}</div> : (
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
                {canSeeSales ? <StatCard label="Ventas de hoy" value={overviewMetrics.todaySalesTotal === null ? null : formatCurrency(overviewMetrics.todaySalesTotal)} secondary={`${overviewMetrics.todaySalesCount} ventas completadas`} scope={branchScope} icon={TrendingUp} tone="positive" href="/admin/analytics" /> : null}
                {canSeeCashMonitor ? <StatCard label="Cajas abiertas" value={overviewMetrics.openCashRegisters} secondary={cashAlertsCount === null ? 'Alertas sin confirmar' : `${cashAlertsCount} alertas pendientes de revisión`} scope={branchScope} icon={Monitor} tone={(cashAlertsCount ?? 0) > 0 ? 'warning' : 'info'} href="/admin/cash-monitor" /> : null}
                {canSeeRepairs ? <StatCard label="Reparaciones en curso" value={repairsError ? null : repairMetrics.active} secondary={`${repairMetrics.urgent} urgentes · ${repairMetrics.today} recibidas hoy`} scope={branchScope} icon={Wrench} tone={repairMetrics.urgent > 0 ? 'warning' : 'info'} href="/dashboard/repairs" /> : canSeeUsers ? <StatCard label="Equipo activo" value={overviewMetrics.activeUsersCount} secondary="Miembros activos, sin importar la sucursal" scope="Toda la organización" icon={Users} href="/admin/users" /> : null}
                {canSeeInventory ? <StatCard label="Productos para reponer" value={overviewMetrics.lowStockCount} secondary="En el stock mínimo o por debajo" scope={selectedBranchId && selectedBranchId !== 'all' ? branchScope : 'Stock global de la organización'} icon={Package} tone={(overviewMetrics.lowStockCount ?? 0) > 0 ? 'warning' : 'neutral'} href="/admin/inventory" /> : null}
              </div>
            )}
          </section>

          {quickLinks.length ? <section aria-labelledby="admin-shortcuts" className="space-y-3"><h2 id="admin-shortcuts" className="text-base font-semibold">Accesos</h2><nav aria-label="Accesos de administración" className="flex flex-wrap gap-2">{quickLinks.map(item => { const Icon = item.icon; return <Button key={item.key} asChild variant="outline" className="h-auto min-h-10 gap-2 rounded-xl px-3 py-2 text-sm"><Link href={item.href!}><Icon className="h-4 w-4" aria-hidden="true" />{item.label}</Link></Button> })}</nav></section> : null}
          {canSeeFinances ? <section aria-label="Resumen financiero"><FinanceSnapshot /></section> : null}
          {canSeeSales || canSeeRepairs ? <section aria-labelledby="admin-trends" className="space-y-3"><h2 id="admin-trends" className="text-base font-semibold">Tendencias</h2><div className={cn('grid gap-4', canSeeSales && canSeeRepairs && 'lg:grid-cols-2')}>
            {canSeeSales ? <Card className="min-w-0 rounded-2xl shadow-none"><CardHeader><CardTitle className="text-base">Ventas</CardTitle><CardDescription>Tendencia semanal</CardDescription></CardHeader><CardContent><SalesChart /></CardContent></Card> : null}
            {hasRepairs ? canSeeRepairs && !repairsError ? <Card className="min-w-0 rounded-2xl shadow-none"><CardHeader><CardTitle className="text-base">Reparaciones</CardTitle><CardDescription>Distribución por estado</CardDescription></CardHeader><CardContent><RepairsChart /></CardContent></Card> : null : null}
          </div></section> : null}
        </TabsContent>
        <TabsContent value="modules" className="space-y-6 m-0 focus-visible:outline-none">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Todas tus herramientas</p>
              <p className="text-xs text-muted-foreground">Buscá una sección o elegí qué querés gestionar.</p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                placeholder="Buscar una sección…" aria-label="Buscar una sección"
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="pl-8 pr-8 h-9 text-xs"
              />
              {moduleFilter ? (
                <button
                  type="button"
                  onClick={() => setModuleFilter('')}
                  className="absolute right-2.5 top-2.5 text-xs text-muted-foreground hover:text-foreground"
                  aria-label="Limpiar filtro"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          {filteredSections.length === 0 ? (
            <Card className="border-dashed p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Search className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">No encontramos esa sección</p>
              <p className="mt-1 text-xs text-muted-foreground">
                No hay coincidencias para &quot;{moduleFilter}&quot;.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModuleFilter('')}
                className="mt-4"
              >
                Limpiar filtro
              </Button>
            </Card>
          ) : (
            filteredSections.map((category) => (
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
                              <p className="text-xs leading-relaxed text-muted-foreground mt-0.5">
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
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FinanceSnapshot } from '@/components/admin/finances/FinanceSnapshot'
import { SalesChart } from '@/components/dashboard/sales-chart'
import { RepairsChart } from '@/components/dashboard/repairs-chart'
import { useRepairs } from '@/contexts/RepairsContext'
import { useAuth } from '@/contexts/auth-context'
import { useBranch } from '@/contexts/branch-context'
import {
  adminNavCategories,
  filterCategoriesByPermissions,
  type NavItem,
} from '@/config/admin-navigation'
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  Clock,
  RefreshCw,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type MetricTone = 'neutral' | 'urgent' | 'positive' | 'waiting'

// Mismo criterio de acento que las tarjetas de Finanzas: el color da jerarquía
// para escanear, nunca es el único indicador — el título dice qué es cada número.
const METRIC_TONE: Record<MetricTone, { border: string; icon: string }> = {
  neutral: { border: 'border-l-blue-500', icon: 'text-blue-500' },
  urgent: { border: 'border-l-destructive', icon: 'text-destructive' },
  positive: { border: 'border-l-emerald-500', icon: 'text-emerald-600 dark:text-emerald-400' },
  waiting: { border: 'border-l-amber-500', icon: 'text-amber-600 dark:text-amber-400' },
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
  note,
}: {
  label: string
  value: number
  icon: LucideIcon
  tone: MetricTone
  note?: string
}) {
  const toneStyle = METRIC_TONE[tone]
  return (
    <Card className={cn('border-l-4 shadow-sm', toneStyle.border)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
          </div>
          <Icon className={cn('h-5 w-5 shrink-0', toneStyle.icon)} aria-hidden="true" />
        </div>
        {note ? (
          <Badge variant="destructive" className="mt-2 text-[10px]">{note}</Badge>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default function AdminHome() {
  const { repairs, isLoading, error, refreshRepairs } = useRepairs()
  const { user, hasPermission, isAdmin } = useAuth()
  const { selectedBranch } = useBranch()

  // Real-time metrics from repairs data
  const metrics = useMemo(() => {
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
    () => filterCategoriesByPermissions(adminNavCategories, hasPermission, isAdmin),
    [hasPermission, isAdmin],
  )

  // "Resumen" es esta misma página: no tiene sentido enlazarla desde acá.
  const sections = useMemo(
    () => navCategories
      .map(category => ({
        ...category,
        items: category.items.filter(item => item.href && item.href !== '/admin'),
      }))
      .filter(category => category.items.length > 0),
    [navCategories],
  )

  // El resumen financiero se consulta contra la organización activa, así que se
  // muestra con el mismo criterio de permisos que la sección de Finanzas.
  const canSeeFinances = isAdmin || hasPermission('finances.read')

  // Solo se muestra el esqueleto en la carga inicial: en un refresco se
  // conservan los números anteriores en vez de parpadear a vacío.
  const showSkeleton = isLoading && repairs.length === 0 && !error
  const branchScope = selectedBranch?.name ?? 'Todas las sucursales'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Panel de Administración
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bienvenido, {user?.profile?.name || user?.email?.split('@')[0] || 'Admin'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Los números cambian al cambiar de sucursal: conviene decir cuál se
              está mirando en vez de dejar que el cambio pase inadvertido. */}
          <Badge variant="outline" className="font-normal text-muted-foreground">
            {branchScope}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refreshRepairs()}
            disabled={isLoading}
            aria-busy={isLoading}
            className="gap-1.5"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} aria-hidden="true" />
            {isLoading ? 'Actualizando…' : 'Actualizar'}
          </Button>
        </div>
      </div>

      {error ? (
        <Card role="alert" className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  No pudimos cargar las reparaciones
                </p>
                <p className="text-sm text-muted-foreground">
                  Los indicadores de abajo pueden estar desactualizados. {error.message}
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void refreshRepairs()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Quick Metrics */}
      {showSkeleton ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true" aria-label="Cargando indicadores">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-[92px] w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Reparaciones Activas" value={metrics.totalActive} icon={Activity} tone="neutral" />
          <MetricCard
            label="Urgentes"
            value={metrics.urgent}
            icon={AlertTriangle}
            tone="urgent"
            note={metrics.urgent > 0 ? 'Requieren atención' : undefined}
          />
          <MetricCard label="Ingresadas Hoy" value={metrics.today} icon={TrendingUp} tone="positive" />
          <MetricCard label="Pendientes" value={metrics.pending} icon={Clock} tone="waiting" />
        </div>
      )}

      {/* Finanzas de la organización, con su propio período */}
      {canSeeFinances ? <FinanceSnapshot /> : null}

      {/* Navigation Grid */}
      {sections.map((category) => (
        <section key={category.id} className="space-y-3" aria-labelledby={`admin-section-${category.id}`}>
          <h2
            id={`admin-section-${category.id}`}
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {category.label}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {category.items.map((item: NavItem) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.key}
                  href={item.href as string}
                  className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Card className="h-full border transition-colors hover:border-primary/40 hover:bg-muted/40">
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="rounded-lg bg-muted p-2.5 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-foreground">{item.label}</h3>
                        <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                      </div>
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5"
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

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0 border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ventas</CardTitle>
            <CardDescription>Tendencia semanal</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <SalesChart />
          </CardContent>
        </Card>
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
    </div>
  )
}

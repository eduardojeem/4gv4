'use client'

import { useMemo, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Ban,
  Building2,
  CheckCircle2,
  ExternalLink,
  Package,
  RefreshCw,
  Search,
  ShieldAlert,
  TrendingUp,
  Users,
  Boxes,
  Minus,
  ChevronDown,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { SortIndicator } from '@/components/superadmin/sort-indicator'
import type { SaasMetricsData, OrgUsageRow, ResourceKey } from '@/lib/superadmin/saas-metrics'
import { calculateUsagePercent } from '@/lib/superadmin/metrics-calculations'
import { useUrlListState } from '@/hooks/useUrlListState'
import {
  filterAndSortOrganizations,
  summarizeSaasHealth,
  type SaasHealthFilter,
  type SaasMetricsSort,
} from './saas-metrics-presentation'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function usageColor(percent: number) {
  if (percent > 100) return 'bg-rose-600'
  if (percent >= 80) return 'bg-red-500'
  if (percent >= 60) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function usageTextColor(percent: number) {
  if (percent > 100) return 'text-rose-600 dark:text-rose-400'
  if (percent >= 80) return 'text-red-600 dark:text-red-400'
  if (percent >= 60) return 'text-amber-600 dark:text-amber-400'
  return 'text-emerald-600 dark:text-emerald-400'
}

function statusLabel(status: string | null) {
  const map: Record<string, string> = {
    active: 'Activo', trialing: 'Prueba', past_due: 'Vencido',
    suspended: 'Suspendido', cancelled: 'Cancelado', canceled: 'Cancelado',
    expired: 'Expirado', unpaid: 'Impago',
  }
  return map[status ?? ''] ?? status ?? 'Sin suscripción'
}

function statusTone(status: string | null) {
  if (status === 'active') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-400'
  if (status === 'trialing') return 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/50 dark:bg-cyan-950/20 dark:text-cyan-400'
  if (status === 'past_due' || status === 'unpaid') return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400'
  if (status === 'suspended') return 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/20 dark:text-orange-400'
  return 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
}

function planTone(plan: string) {
  if (plan === 'PRO') return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/20 dark:text-violet-400'
  if (plan === 'BASIC') return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-400'
  if (plan === 'ENTERPRISE') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-400'
  return 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
}

const RESOURCE_LABELS: Record<ResourceKey, string> = {
  users: 'Usuarios',
  products: 'Productos',
  branches: 'Sucursales',
  cashRegisters: 'Cajas',
  categories: 'Categorías',
}

function miniBar(label: string, current: number, percent: number, limit: number | null) {
  if (limit === null) return (
    <span className="text-xs tabular-nums text-slate-500">{current} / ∞</span>
  )
  const capped = Math.min(percent, 100)
  return (
    <div className="min-w-[96px] space-y-1">
      <div className="flex items-center justify-between gap-2 text-[11px] tabular-nums">
        <span className="font-medium text-slate-700 dark:text-slate-300">{current} / {limit}</span>
        <span className={cn('font-semibold', usageTextColor(percent))}>{percent}%</span>
      </div>
      <div
        className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
        role="progressbar"
        aria-label={`${label}: ${current} de ${limit}`}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(current, limit)}
      >
        <div
          className={cn('h-full rounded-full transition-all', usageColor(percent))}
          style={{ width: `${capped}%` }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Summary metric card
// ---------------------------------------------------------------------------

function MetricCard({
  label, value, sub, icon: Icon, tone,
}: {
  label: string; value: string | number; sub: string
  icon: React.ComponentType<{ className?: string }>
  tone: 'default' | 'danger' | 'warning' | 'success'
}) {
  const tones = {
    default: 'bg-card border',
    danger: 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20',
    warning: 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20',
    success: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20',
  }
  const iconTones = {
    default: 'text-slate-500',
    danger: 'text-red-600 dark:text-red-400',
    warning: 'text-amber-600 dark:text-amber-400',
    success: 'text-emerald-600 dark:text-emerald-400',
  }

  return (
    <div className={cn('rounded-xl border p-5', tones[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{value}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{sub}</p>
        </div>
        <div className={cn('rounded-lg border bg-background p-2', iconTones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Plan distribution bar
// ---------------------------------------------------------------------------

const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-slate-400',
  BASIC: 'bg-blue-500',
  PRO: 'bg-violet-500',
  ENTERPRISE: 'bg-amber-500',
}

function PlanDistributionBar({
  distribution,
  statuses,
}: {
  distribution: SaasMetricsData['planDistribution']
  statuses: SaasMetricsData['statusDistribution']
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Distribución por plan efectivo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="flex h-4 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
          role="img"
          aria-label={distribution.map((item) => `${item.plan}: ${item.percent}%`).join(', ')}
        >
          {distribution.map((d) => (
            <div
              key={d.plan}
              className={cn('transition-all', PLAN_COLORS[d.plan] ?? 'bg-slate-300')}
              style={{ width: `${d.percent}%` }}
              title={`${d.plan}: ${d.count} orgs (${d.percent}%)`}
              aria-hidden="true"
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {distribution.map((d) => (
            <div key={d.plan} className="flex items-center gap-1.5">
              <div aria-hidden="true" className={cn('h-2.5 w-2.5 rounded-full', PLAN_COLORS[d.plan] ?? 'bg-slate-300')} />
              <span className="text-xs text-slate-600 dark:text-slate-400">
                <span className="font-semibold">{d.plan}</span> — {d.count} org{d.count !== 1 ? 's' : ''} ({d.percent}%)
              </span>
            </div>
          ))}
        </div>
        <div className="border-t pt-3">
          <p className="mb-2 text-xs font-semibold text-slate-500">Estado de suscripciones</p>
          <div className="flex flex-wrap gap-2">
            {statuses.map((status) => (
              <Badge key={status.status} variant="outline" className="rounded-full text-[11px]">
                {statusLabel(status.status)}: {status.count}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Org table row
// ---------------------------------------------------------------------------

function OrgRow({ org }: { org: OrgUsageRow }) {
  const resources: ResourceKey[] = ['users', 'products', 'branches', 'cashRegisters', 'categories']

  return (
    <tr className={cn(
      'border-b border-slate-100 dark:border-slate-800 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40',
      org.subscriptionBlocked && 'bg-rose-50/60 dark:bg-rose-950/10',
      !org.subscriptionBlocked && org.overLimit && 'bg-red-50/50 dark:bg-red-950/10',
      !org.subscriptionBlocked && !org.overLimit && org.atRisk && 'bg-amber-50/40 dark:bg-amber-950/10',
      !org.subscriptionBlocked && !org.overLimit && !org.atRisk && org.nearLimit && 'bg-amber-50/20 dark:bg-amber-950/5',
    )}>
      {/* Org name */}
      <td className="py-3 pl-4 pr-3">
        <div className="flex items-center gap-2">
          {org.subscriptionBlocked ? (
            <Ban className="h-4 w-4 shrink-0 text-rose-600" />
          ) : org.overLimit ? (
            <ShieldAlert className="h-4 w-4 shrink-0 text-red-500" />
          ) : org.atRisk || org.nearLimit ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 opacity-60" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{org.name}</p>
            <p className="truncate text-xs text-slate-400">{org.slug}</p>
          </div>
        </div>
      </td>

      {/* Plan */}
      <td className="px-3 py-3">
        <Badge variant="outline" className={cn('rounded-full text-[11px]', planTone(org.plan))}>
          {org.plan}
        </Badge>
        {org.contractedPlanCode !== org.plan && (
          <p className="mt-1 text-[10px] text-slate-500">Contratado: {org.contractedPlanCode}</p>
        )}
      </td>

      {/* Status */}
      <td className="px-3 py-3">
        <Badge variant="outline" className={cn('rounded-full text-[11px]', statusTone(org.subscriptionExpired ? 'past_due' : org.subscriptionStatus))}>
          {org.subscriptionExpired ? 'Vencido' : statusLabel(org.subscriptionStatus)}
        </Badge>
      </td>

      {/* Usage bars */}
      {resources.map((key) => (
        <td key={key} className="px-3 py-3">
          {miniBar(RESOURCE_LABELS[key], org.usage[key], calculateUsagePercent(org.usage[key], org.limits[key]), org.limits[key])}
        </td>
      ))}

      {/* Overall */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className={cn('h-full rounded-full', usageColor(org.overallPercent))}
              style={{ width: `${Math.min(org.overallPercent, 100)}%` }}
            />
          </div>
          <span className={cn('text-xs font-bold tabular-nums', usageTextColor(org.overallPercent))}>
            {org.overallPercent}%
          </span>
        </div>
      </td>

      {/* Action */}
      <td className="py-3 pl-3 pr-4 text-right">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
          <Link href={`/superadmin/organizations?q=${encodeURIComponent(org.slug || org.name)}`} aria-label={`Ver ${org.name}`} title={`Ver ${org.name}`}>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </td>
    </tr>
  )
}

function MobileOrgRow({ org }: { org: OrgUsageRow }) {
  const resources: ResourceKey[] = ['users', 'products', 'branches', 'cashRegisters', 'categories']

  return (
    <article className="space-y-4 px-4 py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {org.subscriptionBlocked ? (
              <Ban className="h-4 w-4 shrink-0 text-rose-600" />
            ) : org.overLimit ? (
              <ShieldAlert className="h-4 w-4 shrink-0 text-red-500" />
            ) : org.atRisk || org.nearLimit ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            )}
            <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{org.name}</h3>
          </div>
          <p className="mt-1 truncate pl-6 text-xs text-slate-400">{org.slug}</p>
        </div>
        <span className={cn('shrink-0 text-sm font-bold tabular-nums', usageTextColor(org.overallPercent))}>
          {org.overallPercent}%
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className={cn('rounded-full text-[11px]', planTone(org.plan))}>
          Plan efectivo: {org.plan}
        </Badge>
        <Badge variant="outline" className={cn('rounded-full text-[11px]', statusTone(org.subscriptionExpired ? 'past_due' : org.subscriptionStatus))}>
          {org.subscriptionExpired ? 'Vencido' : statusLabel(org.subscriptionStatus)}
        </Badge>
        {org.contractedPlanCode !== org.plan && (
          <Badge variant="outline" className="rounded-full text-[11px] text-slate-500">
            Contratado: {org.contractedPlanCode}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {resources.map((key) => (
          <div key={key} className={key === 'categories' ? 'col-span-2' : undefined}>
            <p className="mb-1 text-[10px] font-semibold uppercase text-slate-400">{RESOURCE_LABELS[key]}</p>
            {miniBar(RESOURCE_LABELS[key], org.usage[key], calculateUsagePercent(org.usage[key], org.limits[key]), org.limits[key])}
          </div>
        ))}
      </div>

      <Button asChild variant="outline" size="sm" className="w-full justify-center">
        <Link href={`/superadmin/organizations?q=${encodeURIComponent(org.slug || org.name)}`}>
          Ver organización
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </article>
  )
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

type SortKey = SaasMetricsSort
type FilterKey = SaasHealthFilter
const SORT_KEYS: SortKey[] = ['risk', 'name', 'plan', 'status', 'overall']
const FILTER_KEYS: FilterKey[] = ['all', 'healthy', 'attention', 'intervention', 'trialing', 'expired', 'noSub']

export function SaasMetricsDashboard({ data }: { data: SaasMetricsData }) {
  const router = useRouter()
  const [isRefreshing, startRefresh] = useTransition()
  const { state, setValue } = useUrlListState({
    q: '',
    filter: 'all',
    sort: 'risk',
    dir: 'desc',
    page: '1',
  })
  const search = state.q
  const filter = FILTER_KEYS.includes(state.filter as FilterKey) ? state.filter as FilterKey : 'all'
  const sortKey = SORT_KEYS.includes(state.sort as SortKey) ? state.sort as SortKey : 'risk'
  const sortDir = state.dir === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, Number.parseInt(state.page, 10) || 1)

  function toggleSort(key: SortKey) {
    setValue('sort', key)
    setValue('dir', sortKey === key && sortDir === 'desc' ? 'asc' : 'desc')
    setValue('page', '1')
  }

  const filtered = useMemo(() => filterAndSortOrganizations(data.orgs, {
    search,
    filter,
    sort: sortKey,
    direction: sortDir,
  }), [data.orgs, search, filter, sortDir, sortKey])

  const thClass = 'px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'
  const thBtn = 'flex cursor-pointer select-none items-center hover:text-slate-700 dark:hover:text-slate-200'

  const health = summarizeSaasHealth(data.orgs)
  const primaryFilters: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: 'all', label: 'Todos', count: data.orgs.length },
    { key: 'intervention', label: 'Intervención', count: health.intervention },
    { key: 'attention', label: 'Atención', count: health.attention },
    { key: 'healthy', label: 'Saludables', count: health.healthy },
  ]
  const secondaryFilters: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: 'trialing', label: 'En prueba', count: data.orgs.filter((o) => o.subscriptionStatus === 'trialing').length },
    { key: 'expired', label: 'Vencidas', count: data.orgs.filter((o) => o.subscriptionExpired).length },
    { key: 'noSub', label: 'Sin suscripción', count: data.orgs.filter((o) => !o.subscriptionStatus).length },
  ]
  const pageCount = Math.max(1, Math.ceil(filtered.length / 25))
  const safePage = Math.min(page, pageCount)
  const visibleRows = filtered.slice((safePage - 1) * 25, safePage * 25)
  const ariaSort = (key: SortKey): 'ascending' | 'descending' | 'none' => {
    if (sortKey !== key) return 'none'
    return sortDir === 'asc' ? 'ascending' : 'descending'
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Intervención" value={health.intervention} sub="bloqueadas o sobre el límite" icon={Ban} tone={health.intervention > 0 ? 'danger' : 'success'} />
        <MetricCard label="Atención" value={health.attention} sub="vencidas, sin plan o cerca del límite" icon={AlertTriangle} tone={health.attention > 0 ? 'warning' : 'default'} />
        <MetricCard label="Saludables" value={health.healthy} sub={`de ${data.summary.total} organizaciones`} icon={CheckCircle2} tone="success" />
      </div>

      {/* Plan distribution + most constrained */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PlanDistributionBar distribution={data.planDistribution} statuses={data.statusDistribution} />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Recurso más presionado</CardTitle>
          </CardHeader>
          <CardContent>
            {data.mostConstrainedResource ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                    {data.mostConstrainedResource.label}
                  </span>
                  <span className={cn('text-lg font-bold tabular-nums', usageTextColor(data.mostConstrainedResource.avgPercent))}>
                    {data.mostConstrainedResource.avgPercent}% prom.
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className={cn('h-full rounded-full', usageColor(data.mostConstrainedResource.avgPercent))}
                    style={{ width: `${Math.min(data.mostConstrainedResource.avgPercent, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Promedio de uso de <strong>{data.mostConstrainedResource.label.toLowerCase()}</strong> en orgs con límite definido.
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Sin datos suficientes</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Org table */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Uso por organización</CardTitle>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {filtered.length} de {data.orgs.length} organizaciones · Actualizado {new Date(data.fetchedAt).toLocaleTimeString('es-PY', { timeStyle: 'short' })}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <div className="relative flex-1 sm:flex-none">
                <label htmlFor="saas-metrics-search" className="sr-only">Buscar organización</label>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="saas-metrics-search"
                  className="h-9 w-full pl-9 text-sm sm:w-64"
                  placeholder="Buscar organización..."
                  value={search}
                  onChange={(event) => {
                    setValue('q', event.target.value)
                    setValue('page', '1')
                  }}
                />
              </div>
              <Button
                onClick={() => startRefresh(() => router.refresh())}
                disabled={isRefreshing}
                variant="outline"
                size="sm"
                className="h-9 gap-2"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
                {isRefreshing ? 'Actualizando...' : 'Actualizar'}
              </Button>
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {primaryFilters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  setValue('filter', f.key)
                  setValue('page', '1')
                }}
                aria-pressed={filter === f.key}
                className={cn(
                  'flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
                  filter === f.key
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                )}
              >
                {f.label}
                <span className={cn(
                  'flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold',
                  filter === f.key ? 'bg-indigo-200 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-100' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                )}>
                  {f.count}
                </span>
              </button>
            ))}
            <details className="group relative">
              <summary className="flex h-7 cursor-pointer list-none items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                Más filtros <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
              </summary>
              <div className="absolute right-0 z-20 mt-2 min-w-48 space-y-1 rounded-lg border bg-background p-1.5 shadow-lg">
                {secondaryFilters.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={cn('flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs hover:bg-muted', filter === item.key && 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30')}
                    onClick={() => { setValue('filter', item.key); setValue('page', '1') }}
                  >
                    {item.label}<span className="font-bold tabular-nums">{item.count}</span>
                  </button>
                ))}
              </div>
            </details>
            <div className="flex flex-wrap items-center gap-3 px-2 text-[11px] text-slate-500">
              <span><span className="mr-1 inline-block h-2 w-3 rounded-full bg-amber-500" />60–79% atención</span>
              <span><span className="mr-1 inline-block h-2 w-3 rounded-full bg-red-500" />≥80% riesgo</span>
              <span><span className="mr-1 inline-block h-2 w-3 rounded-full bg-rose-600" />&gt;100% excedido</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="divide-y lg:hidden">
            {filtered.length === 0 ? (
              <div className="py-14 text-center">
                <Minus className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm font-medium text-slate-500">Sin organizaciones con este filtro</p>
              </div>
            ) : (
              visibleRows.map((org) => <MobileOrgRow key={org.id} org={org} />)
            )}
          </div>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1040px]">
              <thead className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className={cn(thClass, 'pl-4')} aria-sort={ariaSort('name')}>
                    <button type="button" className={thBtn} onClick={() => toggleSort('name')}>
                      Organización <SortIndicator active={sortKey === 'name'} direction={sortDir} />
                    </button>
                  </th>
                  <th className={thClass} aria-sort={ariaSort('plan')}>
                    <button type="button" className={thBtn} onClick={() => toggleSort('plan')}>
                      Plan <SortIndicator active={sortKey === 'plan'} direction={sortDir} />
                    </button>
                  </th>
                  <th className={thClass} aria-sort={ariaSort('status')}>
                    <button type="button" className={thBtn} onClick={() => toggleSort('status')}>
                      Estado <SortIndicator active={sortKey === 'status'} direction={sortDir} />
                    </button>
                  </th>
                  <th className={thClass}><div className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Usuarios</div></th>
                  <th className={thClass}><div className="flex items-center gap-1"><Package className="h-3.5 w-3.5" /> Productos</div></th>
                  <th className={thClass}><div className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> Sucursales</div></th>
                  <th className={thClass}><div className="flex items-center gap-1"><Boxes className="h-3.5 w-3.5" /> Cajas</div></th>
                  <th className={thClass}><div className="flex items-center gap-1"><Package className="h-3.5 w-3.5" /> Categorías</div></th>
                  <th className={thClass} aria-sort={ariaSort('overall')}>
                    <button type="button" className={thBtn} onClick={() => toggleSort('overall')}>
                      <TrendingUp className="mr-1 h-3.5 w-3.5" /> Mayor uso <SortIndicator active={sortKey === 'overall'} direction={sortDir} />
                    </button>
                  </th>
                  <th className={cn(thClass, 'pr-4')} />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center">
                      <Minus className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-3 text-sm font-medium text-slate-500">Sin organizaciones con este filtro</p>
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((org) => <OrgRow key={org.id} org={org} />)
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
        {filtered.length > 25 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <span className="text-slate-500">Página {safePage} de {pageCount}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setValue('page', String(Math.max(1, safePage - 1)))}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={safePage >= pageCount} onClick={() => setValue('page', String(Math.min(pageCount, safePage + 1)))}>
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </Card>

    </div>
  )
}

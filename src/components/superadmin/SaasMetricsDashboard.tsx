'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowUpDown,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  ExternalLink,
  Gauge,
  Package,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
  Boxes,
  Minus,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { SaasMetricsData, OrgUsageRow, ResourceKey } from '@/lib/superadmin/saas-metrics'
import { RESOURCE_LABELS, calcPercent } from '@/lib/superadmin/saas-metrics'

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

function miniBar(percent: number, limit: number | null) {
  if (limit === null) return (
    <span className="text-xs text-slate-400">∞</span>
  )
  const capped = Math.min(percent, 100)
  return (
    <div className="flex items-center gap-1.5 min-w-[80px]">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className={cn('h-full rounded-full transition-all', usageColor(percent))}
          style={{ width: `${capped}%` }}
        />
      </div>
      <span className={cn('text-xs tabular-nums font-medium w-8 text-right', usageTextColor(percent))}>
        {percent}%
      </span>
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

function PlanDistributionBar({ distribution }: { distribution: SaasMetricsData['planDistribution'] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Distribución por plan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex h-4 overflow-hidden rounded-full">
          {distribution.map((d) => (
            <div
              key={d.plan}
              className={cn('transition-all', PLAN_COLORS[d.plan] ?? 'bg-slate-300')}
              style={{ width: `${d.percent}%` }}
              title={`${d.plan}: ${d.count} orgs (${d.percent}%)`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {distribution.map((d) => (
            <div key={d.plan} className="flex items-center gap-1.5">
              <div className={cn('h-2.5 w-2.5 rounded-full', PLAN_COLORS[d.plan] ?? 'bg-slate-300')} />
              <span className="text-xs text-slate-600 dark:text-slate-400">
                <span className="font-semibold">{d.plan}</span> — {d.count} org{d.count !== 1 ? 's' : ''} ({d.percent}%)
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Org table row
// ---------------------------------------------------------------------------

function OrgRow({ org }: { org: OrgUsageRow }) {
  const resources: ResourceKey[] = ['users', 'products', 'branches', 'cashRegisters']

  return (
    <tr className={cn(
      'border-b border-slate-100 dark:border-slate-800 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40',
      org.overLimit && 'bg-red-50/50 dark:bg-red-950/10',
      !org.overLimit && org.atRisk && 'bg-amber-50/40 dark:bg-amber-950/10',
    )}>
      {/* Org name */}
      <td className="py-3 pl-4 pr-3">
        <div className="flex items-center gap-2">
          {org.overLimit ? (
            <ShieldAlert className="h-4 w-4 shrink-0 text-red-500" />
          ) : org.atRisk ? (
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
      </td>

      {/* Status */}
      <td className="px-3 py-3">
        <Badge variant="outline" className={cn('rounded-full text-[11px]', statusTone(org.subscriptionStatus))}>
          {statusLabel(org.subscriptionStatus)}
        </Badge>
      </td>

      {/* Usage bars */}
      {resources.map((key) => (
        <td key={key} className="px-3 py-3">
          {miniBar(calcPercent(org.usage[key], org.limits[key]), org.limits[key])}
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
          <Link href={`/superadmin/organizations`} aria-label={`Ver ${org.name}`}>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

type SortKey = 'name' | 'plan' | 'status' | 'overall'
type FilterKey = 'all' | 'atRisk' | 'trialing' | 'overLimit' | 'noSub'

export function SaasMetricsDashboard({ data }: { data: SaasMetricsData }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [sortKey, setSortKey] = useState<SortKey>('overall')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const filtered = useMemo(() => {
    let rows = data.orgs

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter((o) => o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q))
    }

    // Filter
    if (filter === 'atRisk') rows = rows.filter((o) => o.atRisk && !o.overLimit)
    if (filter === 'overLimit') rows = rows.filter((o) => o.overLimit)
    if (filter === 'trialing') rows = rows.filter((o) => o.subscriptionStatus === 'trialing')
    if (filter === 'noSub') rows = rows.filter((o) => !o.subscriptionStatus)

    // Sort
    rows = [...rows].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortKey === 'plan') cmp = a.plan.localeCompare(b.plan)
      else if (sortKey === 'status') cmp = (a.subscriptionStatus ?? '').localeCompare(b.subscriptionStatus ?? '')
      else if (sortKey === 'overall') cmp = a.overallPercent - b.overallPercent
      return sortDir === 'asc' ? cmp : -cmp
    })

    return rows
  }, [data.orgs, search, filter, sortDir, sortKey])

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />
    return sortDir === 'asc'
      ? <ChevronUp className="ml-1 h-3 w-3 text-indigo-500" />
      : <ChevronDown className="ml-1 h-3 w-3 text-indigo-500" />
  }

  const thClass = 'px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'
  const thBtn = 'flex cursor-pointer select-none items-center hover:text-slate-700 dark:hover:text-slate-200'

  const filterBtns: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: 'all', label: 'Todos', count: data.orgs.length },
    { key: 'atRisk', label: '⚠ En riesgo', count: data.summary.atRisk },
    { key: 'overLimit', label: '🔴 Sobre límite', count: data.summary.overLimit },
    { key: 'trialing', label: 'En prueba', count: data.orgs.filter((o) => o.subscriptionStatus === 'trialing').length },
    { key: 'noSub', label: 'Sin suscripción', count: data.orgs.filter((o) => !o.subscriptionStatus).length },
  ]

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Organizaciones" value={data.summary.total} sub="en la plataforma" icon={Building2} tone="default" />
        <MetricCard label="En riesgo" value={data.summary.atRisk} sub="≥80% de algún límite" icon={AlertTriangle} tone={data.summary.atRisk > 0 ? 'warning' : 'default'} />
        <MetricCard label="Sobre el límite" value={data.summary.overLimit} sub="superaron la cuota" icon={ShieldAlert} tone={data.summary.overLimit > 0 ? 'danger' : 'default'} />
        <MetricCard label="Uso promedio" value={`${data.summary.avgUsagePercent}%`} sub="entre todos los tenants" icon={Gauge} tone={data.summary.avgUsagePercent >= 70 ? 'warning' : 'success'} />
      </div>

      {/* Plan distribution + most constrained */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PlanDistributionBar distribution={data.planDistribution} />
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
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="h-9 w-56 pl-9 text-sm"
                  placeholder="Buscar organización..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button asChild variant="outline" size="sm" className="h-9 gap-2">
                <Link href="/superadmin/saas-metrics">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Actualizar
                </Link>
              </Button>
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {filterBtns.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
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
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className={cn(thClass, 'pl-4')}>
                    <button className={thBtn} onClick={() => toggleSort('name')}>
                      Organización <SortIcon col="name" />
                    </button>
                  </th>
                  <th className={thClass}>
                    <button className={thBtn} onClick={() => toggleSort('plan')}>
                      Plan <SortIcon col="plan" />
                    </button>
                  </th>
                  <th className={thClass}>
                    <button className={thBtn} onClick={() => toggleSort('status')}>
                      Estado <SortIcon col="status" />
                    </button>
                  </th>
                  <th className={thClass}><div className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Usuarios</div></th>
                  <th className={thClass}><div className="flex items-center gap-1"><Package className="h-3.5 w-3.5" /> Productos</div></th>
                  <th className={thClass}><div className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> Sucursales</div></th>
                  <th className={thClass}><div className="flex items-center gap-1"><Boxes className="h-3.5 w-3.5" /> Cajas</div></th>
                  <th className={thClass}>
                    <button className={thBtn} onClick={() => toggleSort('overall')}>
                      <TrendingUp className="mr-1 h-3.5 w-3.5" /> Global <SortIcon col="overall" />
                    </button>
                  </th>
                  <th className={cn(thClass, 'pr-4')} />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <Minus className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-3 text-sm font-medium text-slate-500">Sin organizaciones con este filtro</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((org) => <OrgRow key={org.id} org={org} />)
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-dashed px-4 py-3 text-xs text-slate-500">
        <span className="font-semibold">Leyenda:</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-emerald-500" /> &lt;60% OK</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-amber-500" /> 60-80% Atención</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-red-500" /> 80-100% En riesgo</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-rose-600" /> &gt;100% Sobre límite</span>
        <span className="flex items-center gap-1.5"><span>∞</span> Límite ilimitado</span>
      </div>
    </div>
  )
}

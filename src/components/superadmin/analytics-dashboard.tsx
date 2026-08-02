'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  BarChart3,
  Crown,
  DollarSign,
  Download,
  Loader2,
  PieChart as PieChartIcon,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SuperAdminAnalyticsData } from '@/lib/superadmin/analytics'
import { cn } from '@/lib/utils'

const PLAN_COLORS: Record<string, string> = {
  FREE: '#94a3b8',
  BASIC: '#3b82f6',
  STARTER: '#3b82f6',
  PROFESSIONAL: '#8b5cf6',
  PRO: '#8b5cf6',
  ENTERPRISE: '#f59e0b',
}

const emptyAnalytics: SuperAdminAnalyticsData = {
  growthData: [],
  planDistribution: [],
  activityData: [],
  revenueData: { mrr: 0, arr: 0, activeSubscriptions: 0, averageRevenuePerSub: 0 },
  topOrganizations: [],
  generatedAt: new Date().toISOString(),
}

function formatPYG(value: number) {
  return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(value)
}

// ---------------------------------------------------------------------------
// Hero metric
// ---------------------------------------------------------------------------

function HeroMetric({
  label, value, sub, icon: Icon, tone, trend,
}: {
  label: string
  value: string
  sub: string
  icon: React.ComponentType<{ className?: string }>
  tone: 'indigo' | 'emerald' | 'amber' | 'violet'
  trend?: { value: number; label: string }
}) {
  const tones = {
    indigo:  'border-indigo-200/70 bg-card dark:border-indigo-900/60',
    emerald: 'border-emerald-200/70 bg-card dark:border-emerald-900/60',
    amber:   'border-amber-200/70 bg-card dark:border-amber-900/60',
    violet:  'border-violet-200/70 bg-card dark:border-violet-900/60',
  }
  const iconTones = {
    indigo:  'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
    emerald: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    amber:   'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    violet:  'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  }
  return (
    <div className={cn('overflow-hidden rounded-lg border p-5', tones[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-50 truncate">{value}</p>
            {trend && (
              <span className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                trend.value > 0
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : trend.value < 0
                  ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              )}>
                {trend.value > 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : trend.value < 0 ? <ArrowDownRight className="h-2.5 w-2.5" /> : null}
                {trend.value > 0 ? '+' : ''}{trend.value}%
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{trend?.label ?? sub}</p>
        </div>
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', iconTones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

type Period = '3m' | '6m' | '12m'

export function SuperAdminAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<SuperAdminAnalyticsData>(emptyAnalytics)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('6m')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/superadmin/analytics', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || 'Error al cargar analytics')
      setAnalytics(payload as SuperAdminAnalyticsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  function exportCsv() {
    const rows = [
      ['Métrica', 'Valor'],
      ['MRR', analytics.revenueData.mrr],
      ['ARR', analytics.revenueData.arr],
      ['Suscripciones activas', analytics.revenueData.activeSubscriptions],
      ['ARPS (promedio)', analytics.revenueData.averageRevenuePerSub],
      [],
      ['Mes', 'Nuevas organizaciones'],
      ...analytics.growthData.map((g) => [g.month, g.count]),
      [],
      ['Plan', 'Cantidad'],
      ...analytics.planDistribution.map((p) => [p.name, p.value]),
      [],
      ['Mes', 'Altas activas', 'Altas en otros estados'],
      ...analytics.activityData.map((item) => [item.month, item.activeRegistrations, item.otherRegistrations]),
      [],
      ['Organización', 'Personal registrado'],
      ...analytics.topOrganizations.map((organization) => [organization.name, organization.user_count]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  if (loading && analytics.growthData.length === 0) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <p className="text-sm text-slate-500">Cargando analytics...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900/50 dark:bg-red-950/20">
        <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
        <p className="mt-3 text-sm font-semibold text-red-800 dark:text-red-300">Error al cargar analytics</p>
        <p className="mt-1 text-xs text-red-700 dark:text-red-400">{error}</p>
        <Button onClick={refresh} className="mt-4 gap-2" size="sm">
          <RefreshCw className="h-3.5 w-3.5" />
          Reintentar
        </Button>
      </div>
    )
  }

  const { growthData, planDistribution, activityData, revenueData, topOrganizations } = analytics
  const totalOrgs = planDistribution.reduce((sum, item) => sum + item.value, 0)
  const currentMonth = growthData[growthData.length - 1]?.count || 0
  const previousMonth = growthData[growthData.length - 2]?.count || 0
  const growthPercentage = previousMonth > 0
    ? Math.round(((currentMonth - previousMonth) / previousMonth) * 100)
    : (currentMonth > 0 ? 100 : 0)

  // Filter growth data by period
  const periodMonths = period === '3m' ? 3 : period === '12m' ? 12 : 6
  const filteredGrowth = growthData.slice(-periodMonths)
  const filteredActivity = activityData.slice(-periodMonths)

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Período:</span>
          <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
            {(['3m', '6m', '12m'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                aria-pressed={period === p}
                className={cn(
                  'h-7 rounded-md px-3 text-xs font-medium transition-colors',
                  period === p
                    ? 'bg-background shadow-sm text-slate-900 dark:text-slate-50'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                )}
              >
                {p === '3m' && 'Últimos 3 meses'}
                {p === '6m' && 'Últimos 6 meses'}
                {p === '12m' && 'Últimos 12 meses'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportCsv} variant="outline" size="sm" className="gap-2">
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </Button>
          <Button onClick={refresh} variant="outline" size="sm" className="gap-2" disabled={loading}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Hero metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <HeroMetric
          label="MRR"
          value={formatPYG(revenueData.mrr)}
          sub="suscripciones activas cobrables"
          icon={DollarSign}
          tone="emerald"
        />
        <HeroMetric
          label="ARR proyectado"
          value={formatPYG(revenueData.arr)}
          sub="MRR × 12 meses"
          icon={TrendingUp}
          tone="violet"
        />
        <HeroMetric
          label="Suscripciones activas"
          value={revenueData.activeSubscriptions.toString()}
          sub={`ARPS: ${formatPYG(revenueData.averageRevenuePerSub)}`}
          icon={Users}
          tone="indigo"
        />
        <HeroMetric
          label="Crecimiento mensual"
          value={`${growthPercentage >= 0 ? '+' : ''}${growthPercentage}%`}
          sub={`${currentMonth} nuevas este mes`}
          icon={Activity}
          tone="amber"
          trend={{ value: growthPercentage, label: 'vs mes anterior' }}
        />
      </div>

      {/* Charts row 1: Growth + Plan distribution */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Growth chart - 2/3 width */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-900/50 dark:bg-indigo-950/20 dark:text-indigo-400">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Crecimiento de organizaciones</CardTitle>
                  <p className="mt-0.5 text-xs text-slate-500">Nuevos tenants por mes</p>
                </div>
              </div>
                  <Badge variant="outline" className="rounded-full text-xs">
                    Organizaciones: {totalOrgs}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {filteredGrowth.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={filteredGrowth}>
                  <defs>
                    <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                  <XAxis dataKey="month" stroke="#64748b" style={{ fontSize: '11px' }} />
                  <YAxis stroke="#64748b" style={{ fontSize: '11px' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#f1f5f9',
                      fontSize: '12px',
                    }}
                    labelStyle={{ color: '#94a3b8', fontSize: '11px', fontWeight: 'bold' }}
                    formatter={(value: number) => [`${value} organizaciones`, 'Nuevas']}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fill="url(#growthFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
                Sin datos de crecimiento
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plan distribution */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-900/50 dark:bg-violet-950/20 dark:text-violet-400">
                <PieChartIcon className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Por plan</CardTitle>
                <p className="mt-0.5 text-xs text-slate-500">Distribución actual</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {planDistribution.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={planDistribution as unknown as Array<Record<string, string | number>>}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {planDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PLAN_COLORS[entry.name] ?? '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid #475569',
                        borderRadius: '8px',
                        color: '#f1f5f9',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-1.5">
                  {planDistribution.map((p) => {
                    const total = planDistribution.reduce((s, x) => s + x.value, 0)
                    const percent = total > 0 ? Math.round((p.value / total) * 100) : 0
                    return (
                      <div key={p.name} className="flex items-center gap-2 text-xs">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PLAN_COLORS[p.name] ?? '#94a3b8' }} />
                        <span className="flex-1 font-medium text-slate-700 dark:text-slate-300">{p.name}</span>
                        <span className="font-bold tabular-nums text-slate-900 dark:text-slate-50">{p.value}</span>
                        <span className="w-8 text-right text-slate-400">{percent}%</span>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-sm text-slate-400">
                Sin datos
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2: Activity + Top orgs */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Activity */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-400">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Altas de usuarios</CardTitle>
                <p className="mt-0.5 text-xs text-slate-500">Personal registrado por mes y estado actual</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredActivity.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={filteredActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                  <XAxis dataKey="month" stroke="#64748b" style={{ fontSize: '11px' }} />
                  <YAxis stroke="#64748b" style={{ fontSize: '11px' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#f1f5f9',
                      fontSize: '12px',
                    }}
                    labelStyle={{ color: '#94a3b8', fontSize: '11px', fontWeight: 'bold' }}
                  />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  />
                  <Bar dataKey="activeRegistrations" fill="#10b981" name="Actualmente activos" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="otherRegistrations" fill="#64748b" name="Otros estados" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">
                Sin datos de actividad
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top organizations */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-400">
                  <Award className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Top organizaciones</CardTitle>
                  <p className="mt-0.5 text-xs text-slate-500">Ranking por cantidad de usuarios</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {topOrganizations.length > 0 ? (
              <div className="space-y-2">
                {topOrganizations.map((org, index) => {
                  const maxUsers = topOrganizations[0]?.user_count ?? 1
                  const percent = Math.round((org.user_count / maxUsers) * 100)
                  const rankIcons: Record<number, React.ReactNode> = {
                    0: <Crown className="h-3.5 w-3.5 text-amber-500" />,
                    1: <Award className="h-3.5 w-3.5 text-slate-400" />,
                    2: <Award className="h-3.5 w-3.5 text-orange-600" />,
                  }
                  return (
                    <Link
                      key={org.id}
                      href={`/superadmin/organizations?q=${encodeURIComponent(org.slug || org.name)}`}
                      className="block rounded-lg border bg-card p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                          index === 0 ? 'bg-amber-500 text-white'
                          : index === 1 ? 'bg-slate-400 text-white'
                          : index === 2 ? 'bg-orange-600 text-white'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        )}>
                          {index < 3 ? rankIcons[index] : `#${index + 1}`}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{org.name}</p>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${percent}%`,
                                  background: index === 0 ? '#f59e0b' : index === 1 ? '#94a3b8' : index === 2 ? '#ea580c' : '#6366f1',
                                }}
                              />
                            </div>
                            <span className="flex items-center gap-1 text-xs font-bold tabular-nums text-slate-700 dark:text-slate-300">
                              <Users className="h-3 w-3 text-slate-400" />
                              {org.user_count}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">
                Sin datos disponibles
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Última actualización: {new Date(analytics.generatedAt).toLocaleString('es-PY')}</span>
        {growthPercentage !== 0 && (
          <Badge variant="outline" className={cn(
            'rounded-full text-xs',
            growthPercentage > 0
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300'
              : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300'
          )}>
            {growthPercentage > 0 ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
            {growthPercentage > 0 ? 'Crecimiento positivo' : 'Decrecimiento'}
          </Badge>
        )}
      </div>
    </div>
  )
}

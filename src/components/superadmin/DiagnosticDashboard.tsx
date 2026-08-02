'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  Bug,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  ExternalLink,
  Globe,
  Key,
  Loader2,
  Minus,
  Play,
  RefreshCw,
  Shield,
  Wrench,
  XCircle,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CheckStatus = 'ok' | 'warning' | 'error' | 'skipped'
type Category = 'auth' | 'database' | 'env' | 'integration' | 'config'

type CheckResult = {
  id: string
  category: Category
  name: string
  description: string
  status: CheckStatus
  message: string
  latency?: number
  details?: Record<string, unknown>
}

type ApiResponse = {
  checks: CheckResult[]
  counts: { ok: number; warning: number; error: number; skipped: number; total: number }
  totalLatency: number
  runAt: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_META: Record<Category, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  auth:        { label: 'Auth',        icon: Shield,   color: 'text-red-600 dark:text-red-400' },
  database:    { label: 'Base de datos', icon: Database, color: 'text-blue-600 dark:text-blue-400' },
  env:         { label: 'Variables',   icon: Key,      color: 'text-violet-600 dark:text-violet-400' },
  integration: { label: 'Integración', icon: Zap,      color: 'text-emerald-600 dark:text-emerald-400' },
  config:      { label: 'Config',      icon: Wrench,   color: 'text-amber-600 dark:text-amber-400' },
}

const STATUS_META: Record<CheckStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  ok:      { label: 'OK',       color: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300', icon: CheckCircle2 },
  warning: { label: 'Aviso',    color: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300',           icon: AlertCircle },
  error:   { label: 'Error',    color: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300',                       icon: XCircle },
  skipped: { label: 'Omitido',  color: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',                 icon: Minus },
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('es-PY', { timeStyle: 'medium' }).format(new Date(value))
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub, icon: Icon, tone = 'default' }: {
  label: string; value: string | number; sub: string
  icon: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}) {
  const tones = {
    default: 'bg-card border',
    success: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20',
    warning: 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20',
    danger:  'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20',
    info:    'border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20',
  }
  const iconTones = {
    default: 'text-slate-500', success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400', danger: 'text-red-600 dark:text-red-400',
    info: 'text-blue-600 dark:text-blue-400',
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
// Check row
// ---------------------------------------------------------------------------

function CheckRow({ check }: { check: CheckResult }) {
  const [expanded, setExpanded] = useState(false)
  const catMeta = CATEGORY_META[check.category]
  const statusMeta = STATUS_META[check.status]
  const StatusIcon = statusMeta.icon
  const CatIcon = catMeta.icon
  const hasDetails = check.details && Object.keys(check.details).length > 0

  return (
    <div className={cn(
      'rounded-lg border bg-card transition-colors',
      check.status === 'error' && 'border-red-200 dark:border-red-900/60',
      check.status === 'warning' && 'border-amber-200 dark:border-amber-900/60'
    )}>
      <button
        type="button"
        onClick={() => hasDetails && setExpanded(!expanded)}
        disabled={!hasDetails}
        className={cn(
          'flex w-full items-start gap-3 p-3 text-left',
          hasDetails && 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40'
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-muted">
          <CatIcon className={cn('h-4 w-4', catMeta.color)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{check.name}</p>
            <Badge variant="outline" className={cn('rounded-full gap-1 text-[10px]', statusMeta.color)}>
              <StatusIcon className="h-3 w-3" />
              {statusMeta.label}
            </Badge>
            <span className="text-[10px] text-slate-400">{catMeta.label}</span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{check.description}</p>
          <p className="mt-1 text-xs">
            <span className={cn(
              'font-mono',
              check.status === 'ok' && 'text-emerald-700 dark:text-emerald-300',
              check.status === 'warning' && 'text-amber-700 dark:text-amber-300',
              check.status === 'error' && 'text-red-700 dark:text-red-300',
              check.status === 'skipped' && 'text-slate-500'
            )}>
              → {check.message}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs">
          {check.latency !== undefined && (
            <span className={cn(
              'font-mono tabular-nums',
              check.latency < 100 ? 'text-emerald-600 dark:text-emerald-400'
              : check.latency < 500 ? 'text-amber-600 dark:text-amber-400'
              : 'text-red-600 dark:text-red-400'
            )}>
              {check.latency}ms
            </span>
          )}
          {hasDetails && (
            expanded
              ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
              : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          )}
        </div>
      </button>
      {hasDetails && expanded && check.details && (
        <div className="border-t bg-muted/30 p-3">
          <pre className="max-h-48 overflow-auto rounded bg-slate-950 p-2 text-[11px] text-emerald-100">
            {JSON.stringify(check.details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

type CategoryFilter = 'all' | Category
type StatusFilter = 'all' | CheckStatus

export function DiagnosticDashboard() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  async function runDiagnostic() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/superadmin/diagnostic', { cache: 'no-store' })
      const payload = await res.json() as ApiResponse | { error?: string }
      if (!res.ok) {
        setError((payload as { error?: string }).error || 'Error al ejecutar diagnóstico')
        return
      }
      setData(payload as ApiResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setLoading(false)
    }
  }

  // Auto-run on mount
  useEffect(() => {
    runDiagnostic()
  }, [])

  const filteredChecks = data?.checks.filter((c) => {
    const matchCat = categoryFilter === 'all' || c.category === categoryFilter
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    return matchCat && matchStatus
  }) ?? []

  const categoryPills: Array<{ key: CategoryFilter; label: string }> = [
    { key: 'all', label: 'Todas' },
    { key: 'auth', label: 'Auth' },
    { key: 'database', label: 'Database' },
    { key: 'env', label: 'Env' },
    { key: 'integration', label: 'Integración' },
    { key: 'config', label: 'Config' },
  ]

  const statusPills: Array<{ key: StatusFilter; label: string }> = [
    { key: 'all', label: 'Todos' },
    { key: 'error', label: 'Errores' },
    { key: 'warning', label: 'Avisos' },
    { key: 'ok', label: 'OK' },
  ]

  // Overall health
  const overallStatus = !data ? 'loading'
    : data.counts.error > 0 ? 'error'
    : data.counts.warning > 0 ? 'warning'
    : 'ok'

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6">

      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Bug className="h-3.5 w-3.5" />
            Diagnóstico SaaS
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Diagnóstico del sistema</h1>
            {data && (
              <div className={cn(
                'flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                overallStatus === 'ok' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
                overallStatus === 'warning' && 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
                overallStatus === 'error' && 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
              )}>
                <span className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  overallStatus === 'ok' && 'bg-emerald-500',
                  overallStatus === 'warning' && 'bg-amber-500',
                  overallStatus === 'error' && 'bg-red-500',
                )} />
                {overallStatus === 'ok' && 'Todo en orden'}
                {overallStatus === 'warning' && 'Avisos detectados'}
                {overallStatus === 'error' && 'Errores detectados'}
              </div>
            )}
          </div>
          <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Pruebas reales sobre auth, DB, integraciones y variables de entorno.
            {data && <> Última ejecución: <span className="font-mono">{formatTime(data.runAt)}</span> · {data.totalLatency}ms total</>}
          </p>
        </div>
        <Button onClick={runDiagnostic} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {loading ? 'Ejecutando...' : data ? 'Re-ejecutar' : 'Ejecutar diagnóstico'}
        </Button>
      </header>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/20">
          <XCircle className="h-5 w-5 shrink-0 text-red-500" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="flex items-center justify-center py-24">
          <div className="flex items-center gap-3 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Ejecutando checks...</span>
          </div>
        </div>
      )}

      {data && (
        <>
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Checks ejecutados"
              value={data.counts.total}
              sub={`${data.totalLatency}ms total`}
              icon={Bug}
            />
            <StatCard
              label="OK"
              value={data.counts.ok}
              sub={`${Math.round((data.counts.ok / data.counts.total) * 100)}% del total`}
              icon={CheckCircle2}
              tone="success"
            />
            <StatCard
              label="Avisos"
              value={data.counts.warning}
              sub="requieren atención"
              icon={AlertCircle}
              tone={data.counts.warning > 0 ? 'warning' : 'default'}
            />
            <StatCard
              label="Errores"
              value={data.counts.error}
              sub={data.counts.error > 0 ? 'bloquean funcionalidad' : 'sin errores críticos'}
              icon={XCircle}
              tone={data.counts.error > 0 ? 'danger' : 'success'}
            />
          </div>

          {/* Filters + checks */}
          <Card>
            <CardHeader className="border-b pb-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="text-base">Resultados</CardTitle>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                    {filteredChecks.length} de {data.checks.length} checks
                  </p>
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={runDiagnostic} disabled={loading}>
                  <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                  Re-ejecutar
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                {/* Status pills */}
                <div className="flex gap-1">
                  {statusPills.map((p) => {
                    const count = p.key === 'all'
                      ? data.counts.total
                      : data.counts[p.key as keyof typeof data.counts]
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setStatusFilter(p.key)}
                        className={cn(
                          'flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
                          statusFilter === p.key
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                        )}
                      >
                        {p.label}
                        <span className={cn(
                          'flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold',
                          statusFilter === p.key ? 'bg-indigo-200 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-100' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        )}>
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

                {/* Category pills */}
                <div className="flex flex-wrap gap-1">
                  {categoryPills.map((p) => {
                    const count = p.key === 'all'
                      ? data.checks.length
                      : data.checks.filter((c) => c.category === p.key).length
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setCategoryFilter(p.key)}
                        className={cn(
                          'flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
                          categoryFilter === p.key
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                        )}
                      >
                        {p.label}
                        <span className="text-[10px] font-bold text-slate-400">{count}</span>
                      </button>
                    )
                  })}
                </div>

                {(categoryFilter !== 'all' || statusFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => { setCategoryFilter('all'); setStatusFilter('all') }}
                    className="h-7 rounded-full px-3 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    Reset
                  </button>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-2 p-4">
              {filteredChecks.length === 0 ? (
                <div className="py-12 text-center">
                  <Minus className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm text-slate-500">Sin checks con estos filtros</p>
                </div>
              ) : (
                filteredChecks.map((c) => <CheckRow key={c.id} check={c} />)
              )}
            </CardContent>
          </Card>

          {/* Quick links */}
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { href: '/superadmin/monitoring', icon: Globe, label: 'Monitoreo', sub: 'Health en vivo' },
              { href: '/superadmin/audit-logs', icon: Shield, label: 'Audit logs', sub: 'Historial de eventos' },
              { href: '/superadmin/settings', icon: Wrench, label: 'Settings', sub: 'Configuración global' },
            ].map((l) => {
              const Icon = l.icon
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <Icon className="h-5 w-5 text-slate-400" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{l.label}</p>
                    <p className="text-xs text-slate-400">{l.sub}</p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-slate-300" />
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

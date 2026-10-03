'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ChevronRight,
  CreditCard,
  Database,
  Globe,
  HeartPulse,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { runSystemHealthAction } from '@/app/superadmin/system-health/actions'
import { evaluateReadiness } from '@/lib/health/readiness'
import type {
  HealthCategory,
  HealthCheckResult,
  HealthHistoryResult,
  HealthReport,
  HealthStatus,
} from '@/lib/health/types'
import { CheckDetailSheet, SeverityBadge, StatusBadge } from './CheckDetailSheet'
import { HealthHistoryPanel } from './HealthHistoryPanel'
import { CATEGORY_LABEL, CATEGORY_ORDER, STATUS_META, formatDateTime } from './health-meta'

type SeverityRules = Record<string, string[]>

const AREAS: Array<{ id: string; label: string; icon: typeof Globe; categories: HealthCategory[] }> = [
  { id: 'web', label: 'Web', icon: Globe, categories: ['legal', 'seo', 'ux', 'performance'] },
  { id: 'supabase', label: 'Supabase', icon: Database, categories: ['supabase', 'auth', 'storage'] },
  { id: 'security', label: 'Seguridad', icon: ShieldCheck, categories: ['security', 'tenancy'] },
  { id: 'payments', label: 'Pagos', icon: CreditCard, categories: ['payments', 'webhooks'] },
]

const OVERALL_LABEL: Record<HealthStatus, string> = {
  healthy: 'OPERATIVO',
  warning: 'CON ADVERTENCIAS',
  error: 'CON ERRORES',
  unknown: 'SIN DATOS',
  not_configured: 'SIN DATOS',
}

/** Estado de un conjunto: los no verificables no cuentan como sanos ni como fallas. */
function aggregate(checks: HealthCheckResult[]): HealthStatus {
  const statuses = checks.map((c) => c.status)
  if (statuses.includes('error')) return 'error'
  if (statuses.includes('warning')) return 'warning'
  if (statuses.includes('healthy')) return statuses.every((s) => s === 'healthy') ? 'healthy' : 'warning'
  return statuses.includes('unknown') ? 'unknown' : 'not_configured'
}

function CheckRow({ check, onOpen }: { check: HealthCheckResult; onOpen: (check: HealthCheckResult) => void }) {
  const meta = STATUS_META[check.status]
  const Icon = meta.icon
  return (
    <button
      type="button"
      onClick={() => onOpen(check)}
      className="flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-slate-800/40"
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', meta.text)} aria-label={meta.label} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{check.name}</span>
          {check.status !== 'healthy' && check.severity !== 'info' && <SeverityBadge severity={check.severity} />}
        </span>
        <span className="block break-words text-xs text-slate-500 dark:text-slate-400">{check.summary}</span>
      </span>
      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
    </button>
  )
}

function SkeletonCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-xl border bg-slate-100 dark:bg-slate-800/50" />
      ))}
    </div>
  )
}

export function SystemHealthDashboard({
  initialHistory,
  severityRules,
}: {
  initialHistory: HealthHistoryResult
  severityRules: SeverityRules
}) {
  const [report, setReport] = useState<HealthReport | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<HealthCheckResult | null>(null)
  const [tenantFilter, setTenantFilter] = useState<'issues' | 'all'>('issues')
  const runningRef = useRef(false)

  const run = useCallback(async () => {
    // Un solo diagnóstico a la vez desde esta pestaña; el servidor además
    // comparte la ejecución en curso entre pestañas y usuarios.
    if (runningRef.current) return
    runningRef.current = true
    setRunning(true)
    setError(null)
    try {
      const result = await runSystemHealthAction()
      if ('error' in result) setError(result.error)
      else setReport(result.data)
    } catch {
      setError('No se pudo contactar al servidor. Revisá la conexión y reintentá.')
    } finally {
      runningRef.current = false
      setRunning(false)
    }
  }, [])

  useEffect(() => {
    void run()
  }, [run])

  const byCategory = useMemo(() => {
    const map = new Map<HealthCategory, HealthCheckResult[]>()
    for (const check of report?.checks ?? []) {
      map.set(check.category, [...(map.get(check.category) ?? []), check])
    }
    return map
  }, [report])

  const readiness = useMemo(() => evaluateReadiness(report?.checks ?? []), [report])
  const pending = useMemo(
    () => (report?.checks ?? []).filter((c) => c.status !== 'healthy'),
    [report],
  )
  const verifiedCount = report
    ? report.counts.healthy + report.counts.warning + report.counts.error
    : 0
  const recentIncidents = useMemo(
    () => (initialHistory.available ? initialHistory.entries.filter((e) => e.status === 'error' || e.status === 'warning').slice(0, 8) : []),
    [initialHistory],
  )
  const tenantTables = useMemo(
    () => (report?.tenantTables ?? []).filter((t) => tenantFilter === 'all' || t.status !== 'healthy'),
    [report, tenantFilter],
  )

  const supabaseRows: Array<{ label: string; id: string }> = [
    { label: 'Database', id: 'supabase.database' },
    { label: 'Auth', id: 'supabase.auth' },
    { label: 'Storage', id: 'supabase.storage' },
    { label: 'RLS', id: 'tenancy.rls' },
    { label: 'Aislamiento', id: 'tenancy.policies' },
  ]
  const checkById = useMemo(() => new Map((report?.checks ?? []).map((c) => [c.id, c])), [report])

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            <HeartPulse className="h-6 w-6 text-rose-500" aria-hidden /> Salud del sistema
          </h1>
          <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Cada estado sale de una comprobación real contra la base, los servicios y el sitio público. Lo que no se puede verificar aparece como «No disponible».
          </p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <Button onClick={run} disabled={running} aria-busy={running} className="min-w-48">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : report ? <RefreshCw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {running ? 'Comprobando...' : 'Ejecutar diagnóstico'}
          </Button>
          <p className="text-xs text-slate-500" aria-live="polite">
            {report ? `Última comprobación: ${formatDateTime(report.finishedAt)} · ${(report.durationMs / 1000).toFixed(1)} s` : running ? 'Ejecutando comprobaciones...' : 'Sin comprobaciones en esta sesión'}
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={run} disabled={running}>Reintentar</Button>
        </div>
      )}

      {report && !report.historyPersisted && report.historyError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          {report.historyError}
        </div>
      )}

      {!report && running && <SkeletonCards />}

      {report && (
        <>
          {/* Estado general */}
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
            <Card className={cn('rounded-xl border-2', STATUS_META[report.overall].badge)}>
              <CardContent className="space-y-3 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider opacity-80">Sistema</p>
                <p className="text-2xl font-black tracking-tight">{OVERALL_LABEL[report.overall]}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {(['healthy', 'warning', 'error', 'unknown', 'not_configured'] as const).map((s) => (
                    <span key={s} className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2 py-0.5 font-semibold text-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
                      <span className={cn('h-2 w-2 rounded-full', STATUS_META[s].dot)} /> {report.counts[s]} {STATUS_META[s].label.toLowerCase()}
                    </span>
                  ))}
                </div>
                <p className="text-xs font-semibold opacity-90">
                  {verifiedCount}/{report.checks.length} controles verificados
                </p>
                <p className="text-xs opacity-80">Origen auditado: {report.target} · Entorno: {report.environment}</p>
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {AREAS.map((area) => {
                const checks = area.categories.flatMap((c) => byCategory.get(c) ?? [])
                const status = aggregate(checks)
                const meta = STATUS_META[status]
                const StatusIcon = meta.icon
                return (
                  <Card key={area.id} className="rounded-xl">
                    <CardContent className="flex h-full flex-col justify-between gap-2 p-4">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                          <area.icon className="h-4 w-4" aria-hidden /> {area.label}
                        </span>
                        <StatusIcon className={cn('h-5 w-5', meta.text)} aria-hidden />
                      </div>
                      <p className={cn('text-sm font-bold', meta.text)}>{meta.label}</p>
                      <p className="text-xs text-slate-500">
                        {checks.filter((c) => c.status === 'healthy').length}/{checks.length} correctos
                      </p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <div className="overflow-x-auto">
              <TabsList className="w-max">
                <TabsTrigger value="overview">Resumen</TabsTrigger>
                <TabsTrigger value="readiness">Preparación para producción</TabsTrigger>
                <TabsTrigger value="tenancy">Multi-tenant</TabsTrigger>
                <TabsTrigger value="checks">Todas ({report.checks.length})</TabsTrigger>
                <TabsTrigger value="history">Historial</TabsTrigger>
                <TabsTrigger value="rules">Severidad</TabsTrigger>
              </TabsList>
            </div>

            {/* ---------------------------------------------------- Resumen */}
            <TabsContent value="overview" className="space-y-4">
              <Card className="rounded-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Checklist de lanzamiento</CardTitle>
                  <CardDescription>{readiness.approved} de {readiness.total} ítems aprobados. Lo no verificado no cuenta como aprobado.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Progress value={(readiness.approved / readiness.total) * 100} aria-label="Progreso de preparación" />
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="rounded-xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4" /> Supabase Health</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {supabaseRows.map((row) => {
                      const check = checkById.get(row.id)
                      return check ? <CheckRow key={row.id} check={{ ...check, name: row.label }} onOpen={() => setSelected(check)} /> : null
                    })}
                  </CardContent>
                </Card>

                <Card className="rounded-xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" /> Pendientes priorizados</CardTitle>
                    <CardDescription>Incluye errores, advertencias y controles que todavía no tienen evidencia.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {pending.length === 0 ? (
                      <p className="py-6 text-center text-sm text-slate-500">Todos los controles fueron verificados y están correctos.</p>
                    ) : (
                      pending.slice(0, 10).map((check) => <CheckRow key={check.id} check={check} onOpen={setSelected} />)
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {report.metrics.map((group) => (
                  <Card key={group.id} className="rounded-xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{group.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <dl className="grid grid-cols-2 gap-3">
                        {group.metrics.map((metric) => (
                          <div key={metric.label} className="min-w-0">
                            <dt className="text-xs text-slate-500">{metric.label}</dt>
                            {metric.value === null ? (
                              <dd className="text-sm font-semibold text-sky-700 dark:text-sky-300" title={metric.unavailableReason}>
                                No disponible
                                {metric.unavailableReason && <span className="block text-[11px] font-normal text-slate-500">{metric.unavailableReason}</span>}
                              </dd>
                            ) : (
                              <dd className="break-words text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">{metric.value}</dd>
                            )}
                          </div>
                        ))}
                      </dl>
                      {group.rows && group.rows.length > 0 && (
                        <ul className="max-h-56 divide-y overflow-y-auto rounded-lg border text-xs dark:divide-slate-800 dark:border-slate-800">
                          {group.rows.map((row, index) => (
                            <li key={`${row.label}-${index}`} className="flex items-center justify-between gap-2 px-3 py-1.5">
                              <span className="min-w-0 truncate text-slate-700 dark:text-slate-300">{row.label}</span>
                              <span className="shrink-0 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                                {row.value}
                                {row.hint && <span className="ml-1 font-normal text-slate-500">({row.hint})</span>}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Historial de incidentes</CardTitle>
                  <CardDescription>
                    Advertencias y errores de ejecuciones anteriores; pueden estar resueltos. El estado vigente es el del diagnóstico mostrado arriba.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!initialHistory.available ? (
                    <p className="text-sm text-slate-500">{initialHistory.reason}</p>
                  ) : recentIncidents.length === 0 ? (
                    <p className="text-sm text-slate-500">Sin incidentes registrados todavía.</p>
                  ) : (
                    <ul className="divide-y dark:divide-slate-800">
                      {recentIncidents.map((entry) => (
                        <li key={entry.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                          <span className="min-w-0">
                            <span className="block text-xs font-mono text-slate-500">{formatDateTime(entry.checkedAt)}</span>
                            <span className="block text-sm font-semibold">{CATEGORY_LABEL[entry.category] ?? entry.category}</span>
                            <span className="block break-words text-sm text-slate-600 dark:text-slate-300">{entry.message}</span>
                          </span>
                          <StatusBadge status={entry.status} className="self-start sm:self-center" />
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ---------------------------------------------------- Preparación */}
            <TabsContent value="readiness">
              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle className="text-base">Preparación para producción</CardTitle>
                  <CardDescription>
                    {readiness.approved}/{readiness.total} aprobados. Un ítem solo se aprueba si todas sus comprobaciones dieron «Correcto».
                  </CardDescription>
                  <Progress value={(readiness.approved / readiness.total) * 100} className="mt-2" aria-label="Progreso de preparación" />
                </CardHeader>
                <CardContent>
                  <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {readiness.rows.map((row) => {
                      const meta = STATUS_META[row.status]
                      const Icon = meta.icon
                      const first = row.checks.find((c) => c.status === row.status) ?? row.checks[0]
                      return (
                        <li key={row.item.id}>
                          <button
                            type="button"
                            disabled={!first}
                            onClick={() => first && setSelected(first)}
                            className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-slate-50 disabled:cursor-default dark:border-slate-800 dark:hover:bg-slate-800/40"
                          >
                            <Icon className={cn('h-5 w-5 shrink-0', meta.text)} aria-hidden />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold">{row.item.label}{row.item.optional ? ' (opcional)' : ''}</span>
                              <span className={cn('block text-xs', meta.text)}>{row.approved ? 'Aprobado' : meta.label}</span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ---------------------------------------------------- Multi-tenant */}
            <TabsContent value="tenancy" className="space-y-4">
              <Card className="rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Seguridad multi-tenant</CardTitle>
                  <CardDescription>
                    Análisis del texto real de las políticas RLS (pg_policies). No se ejecutan pruebas contra datos de clientes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-1">
                  {(byCategory.get('tenancy') ?? []).map((check) => <CheckRow key={check.id} check={check} onOpen={setSelected} />)}
                </CardContent>
              </Card>

              <Card className="rounded-xl">
                <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base">RLS por tabla</CardTitle>
                    <CardDescription>{report.tenantTables.length} tablas analizadas</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant={tenantFilter === 'issues' ? 'default' : 'outline'} onClick={() => setTenantFilter('issues')}>Con hallazgos</Button>
                    <Button size="sm" variant={tenantFilter === 'all' ? 'default' : 'outline'} onClick={() => setTenantFilter('all')}>Todas</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {report.tenantTables.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">
                      No disponible: el catálogo de políticas requiere la migración del centro de diagnóstico.
                    </p>
                  ) : tenantTables.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">Ninguna tabla con hallazgos.</p>
                  ) : (
                    <ul className="divide-y rounded-lg border dark:divide-slate-800 dark:border-slate-800">
                      {tenantTables.map((table) => {
                        const meta = STATUS_META[table.status]
                        const Icon = meta.icon
                        return (
                          <li key={table.table} className="flex gap-3 p-3">
                            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', meta.text)} aria-label={meta.label} />
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-sm font-semibold">{table.table}</span>
                                {table.status !== 'healthy' && <SeverityBadge severity={table.severity} />}
                              </div>
                              <ul className="space-y-0.5">
                                {table.reasons.map((reason) => (
                                  <li key={reason} className="break-words text-xs text-slate-600 dark:text-slate-300">{reason}</li>
                                ))}
                              </ul>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ---------------------------------------------------- Todas */}
            <TabsContent value="checks" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((category) => {
                const checks = byCategory.get(category) ?? []
                return (
                  <Card key={category} className="rounded-xl">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-base">{CATEGORY_LABEL[category]}</CardTitle>
                      <StatusBadge status={aggregate(checks)} />
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {checks.map((check) => <CheckRow key={check.id} check={check} onOpen={setSelected} />)}
                    </CardContent>
                  </Card>
                )
              })}
            </TabsContent>

            {/* ---------------------------------------------------- Historial */}
            <TabsContent value="history">
              <HealthHistoryPanel initial={initialHistory} />
            </TabsContent>

            {/* ---------------------------------------------------- Reglas */}
            <TabsContent value="rules">
              <Card className="rounded-xl">
                <CardHeader>
                  <CardTitle className="text-base">Reglas de severidad</CardTitle>
                  <CardDescription>La severidad describe el impacto técnico si el hallazgo es real. Definidas en src/lib/health/core.ts.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(severityRules).map(([severity, rules]) => (
                    <div key={severity} className="space-y-1.5">
                      <SeverityBadge severity={severity as HealthCheckResult['severity']} />
                      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
                        {rules.map((rule) => <li key={rule}>{rule}</li>)}
                      </ul>
                    </div>
                  ))}
                  <div className="space-y-1.5">
                    <Badge variant="outline" className="rounded-full">Estados</Badge>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
                      <li><b>Correcto</b>: comprobado y sin problemas.</li>
                      <li><b>Advertencia / Error</b>: comprobado con problemas.</li>
                      <li><b>No configurado</b>: la integración o el recurso no existe.</li>
                      <li><b>No disponible</b>: no se pudo verificar (falta integración o requiere revisión manual). Nunca cuenta como aprobado.</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {!report && !running && !error && (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-slate-500">
          Ejecutá un diagnóstico para ver el estado del sistema.
        </p>
      )}

      <CheckDetailSheet check={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  )
}

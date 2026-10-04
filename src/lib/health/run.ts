import { randomUUID } from 'node:crypto'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { loadHealthCatalog } from '@/lib/health/catalog'
import { sanitizeGuidedActions, worstStatus } from '@/lib/health/core'
import { compareHealthChecks, prioritizeHealthChecks } from '@/lib/health/comparison'
import { persistReport, readPreviousRun } from '@/lib/health/history'
import { createSiteProbe } from '@/lib/health/site-probe'
import { runSupabaseChecks } from '@/lib/health/checks/supabase'
import { runWebChecks } from '@/lib/health/checks/web'
import { buildScheduledTaskHealth, buildServiceHealthEntries, runIntegrationChecks } from '@/lib/health/checks/integrations'
import { runIntegrityChecks } from '@/lib/health/checks/integrity'
import {
  HEALTH_STATUSES,
  type HealthCheckResult,
  type HealthGuidedAction,
  type HealthHistoryResult,
  type HealthMetricGroup,
  type HealthReport,
  type HealthStatus,
  type TenantTableFinding,
} from '@/lib/health/types'

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
  throw new Error('lib/health/run solo puede ejecutarse en el servidor')
}

/**
 * Una sola ejecución en curso por instancia: los clics repetidos (o varias
 * pestañas) reciben el mismo resultado en vez de lanzar otra ronda de
 * consultas y requests. Además se reutiliza el último informe durante unos
 * segundos para absorber dobles envíos.
 */
let inFlight: Promise<HealthReport> | null = null
let lastReport: { report: HealthReport; at: number } | null = null
const REUSE_WINDOW_MS = 10_000

export async function runSystemHealth(triggeredBy: string): Promise<HealthReport> {
  if (inFlight) return inFlight
  if (lastReport && Date.now() - lastReport.at < REUSE_WINDOW_MS) return lastReport.report

  inFlight = execute(triggeredBy).finally(() => {
    inFlight = null
  })
  const report = await inFlight
  lastReport = { report, at: Date.now() }
  return report
}

async function execute(triggeredBy: string): Promise<HealthReport> {
  const runId = randomUUID()
  const startedAt = new Date()
  const admin = createAdminSupabase()
  const probe = createSiteProbe()

  const [catalog, previous] = await Promise.all([loadHealthCatalog(admin), readPreviousRun(admin, runId)])
  const [supabase, web, integrations, integrity] = await Promise.all([
    runSupabaseChecks(admin, catalog),
    runWebChecks(probe),
    runIntegrationChecks(admin, probe),
    runIntegrityChecks(admin),
  ])

  const finishedAt = new Date()
  const report = composeOperationalReport({
    runId,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    target: probe.origin,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
    checks: [...supabase.checks, ...web.checks, ...integrations.checks, ...integrity],
    metrics: [...supabase.metrics, ...web.metrics, ...integrations.metrics],
    tenantTables: supabase.tenantTables,
    previous,
  })

  const persisted = await persistReport(admin, report, triggeredBy)
  report.historyPersisted = persisted.ok
  if ('reason' in persisted) report.historyError = persisted.reason
  return report
}

interface ComposeOperationalReportInput {
  runId: string
  startedAt: string
  finishedAt: string
  target: string
  environment: string
  checks: HealthCheckResult[]
  metrics: HealthMetricGroup[]
  tenantTables: TenantTableFinding[]
  previous: HealthHistoryResult
}

function guidedActionsFor(check: HealthCheckResult): HealthGuidedAction[] {
  if (check.status === 'healthy' || check.status === 'unknown') return []
  const actions: HealthGuidedAction[] = []
  if (check.id === 'security.rate_limiting') {
    actions.push({ type: 'file', label: 'Revisar limitador compartido', target: 'src/lib/rate-limiter.ts' })
  }
  if (check.id === 'performance.images') {
    actions.push({ type: 'file', label: 'Revisar política de imágenes', target: 'src/lib/image-url-policy.ts' })
  }
  if (check.id === 'supabase.migrations') {
    actions.push({ type: 'command', label: 'Comparar migraciones', target: 'npx supabase migration list --linked' })
  }
  if (check.id === 'deployment.env') {
    for (const finding of check.findings) {
      const variable = finding.match(/\b[A-Z][A-Z0-9_]{2,}\b/)?.[0]
      if (variable && /faltante/i.test(finding)) {
        actions.push({ type: 'env', label: `Configurar ${variable}`, target: variable })
      }
    }
  }
  return sanitizeGuidedActions(actions)
}

export function composeOperationalReport(input: ComposeOperationalReportInput): HealthReport {
  const previousEntries = input.previous.available ? input.previous.entries : []
  const previousRunId = previousEntries[0]?.runId ?? null
  const previousCheckedAt = previousEntries[0]?.checkedAt ?? null
  const comparison = compareHealthChecks(input.checks, previousEntries, previousRunId, previousCheckedAt)
  const checksWithActions = input.checks.map((check) => ({ ...check, guidedActions: guidedActionsFor(check) }))
  const checks = prioritizeHealthChecks(checksWithActions, comparison.changes)
  const counts = Object.fromEntries(HEALTH_STATUSES.map((status) => [status, 0])) as Record<HealthStatus, number>
  for (const check of checks) counts[check.status] += 1
  const unavailableSources = checks
    .filter((check) => check.status === 'unknown' || check.status === 'not_configured')
    .map((check) => check.id)
  const startedAt = Date.parse(input.startedAt)
  const finishedAt = Date.parse(input.finishedAt)

  return {
    runId: input.runId,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    durationMs: Math.max(Number.isFinite(finishedAt - startedAt) ? finishedAt - startedAt : 0, 0),
    target: input.target,
    environment: input.environment,
    checks,
    metrics: input.metrics,
    tenantTables: input.tenantTables,
    counts,
    overall: worstStatus(checks.map((check) => check.status)),
    comparison,
    executiveSummary: comparison.executiveSummary,
    deployment: input.metrics.find((group) => group.id === 'deployment') ?? null,
    serviceHealth: buildServiceHealthEntries(checks),
    scheduledTasks: buildScheduledTaskHealth(checks),
    scope: { complete: unavailableSources.length === 0, unavailableSources },
    historyPersisted: false,
    historyError: input.previous.available ? undefined : input.previous.reason,
  }
}

import { randomUUID } from 'node:crypto'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { loadHealthCatalog } from '@/lib/health/catalog'
import { compareSeverity, worstStatus } from '@/lib/health/core'
import { persistReport } from '@/lib/health/history'
import { createSiteProbe } from '@/lib/health/site-probe'
import { runSupabaseChecks } from '@/lib/health/checks/supabase'
import { runWebChecks } from '@/lib/health/checks/web'
import { runIntegrationChecks } from '@/lib/health/checks/integrations'
import { runIntegrityChecks } from '@/lib/health/checks/integrity'
import { HEALTH_STATUSES, type HealthReport, type HealthStatus } from '@/lib/health/types'

if (typeof window !== 'undefined') {
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

  const catalog = await loadHealthCatalog(admin)
  const [supabase, web, integrations, integrity] = await Promise.all([
    runSupabaseChecks(admin, catalog),
    runWebChecks(probe),
    runIntegrationChecks(admin, probe),
    runIntegrityChecks(admin),
  ])

  const checks = [...supabase.checks, ...web.checks, ...integrations.checks, ...integrity].sort(
    (a, b) => statusRank(a.status) - statusRank(b.status) || compareSeverity(a.severity, b.severity),
  )
  const counts = Object.fromEntries(HEALTH_STATUSES.map((status) => [status, 0])) as Record<HealthStatus, number>
  for (const check of checks) counts[check.status] += 1

  const finishedAt = new Date()
  const report: HealthReport = {
    runId,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    target: probe.origin,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
    checks,
    metrics: [...supabase.metrics, ...web.metrics, ...integrations.metrics],
    tenantTables: supabase.tenantTables,
    counts,
    // Los checks "unknown"/"not_configured" no convierten al sistema en sano ni en caído.
    overall: worstStatus(checks.map((c) => c.status).filter((s) => s === 'error' || s === 'warning' || s === 'healthy')),
    historyPersisted: false,
  }

  const persisted = await persistReport(admin, report, triggeredBy)
  report.historyPersisted = persisted.ok
  if ('reason' in persisted) report.historyError = persisted.reason
  return report
}

function statusRank(status: HealthStatus): number {
  return ['error', 'warning', 'unknown', 'not_configured', 'healthy'].indexOf(status)
}

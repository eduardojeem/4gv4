import type { SupabaseClient } from '@supabase/supabase-js'
import { HEALTH_MIGRATION, isMissingObjectError } from '@/lib/health/catalog'
import { errorMessage } from '@/lib/health/core'
import {
  HEALTH_SEVERITIES,
  HEALTH_STATUSES,
  type HealthCategory,
  type HealthHistoryEntry,
  type HealthHistoryResult,
  type HealthReport,
  type HealthSeverity,
  type HealthStatus,
} from '@/lib/health/types'

type Row = {
  id: number
  run_id: string
  checked_at: string
  check_id: string
  category: HealthCategory
  status: HealthStatus
  severity: HealthSeverity
  message: string
  duration_ms: number | null
}

export interface HealthPreviousRunResult extends HealthHistoryResult {
  runId: string | null
  checkedAt: string | null
}

export interface HealthRunSummary {
  runId: string
  startedAt: string
  finishedAt: string
  durationMs: number
  checkCount: number
  counts: Record<HealthStatus, number>
}

function mapHistoryRow(row: Row): HealthHistoryEntry {
  return {
    id: row.id,
    runId: row.run_id,
    checkedAt: row.checked_at,
    checkId: row.check_id,
    category: row.category,
    status: (HEALTH_STATUSES as string[]).includes(row.status) ? row.status : 'unknown',
    severity: (HEALTH_SEVERITIES as string[]).includes(row.severity) ? row.severity : 'info',
    message: row.message,
    durationMs: row.duration_ms,
  }
}

function unavailablePreviousRun(error: { code?: string; message?: string } | unknown): HealthPreviousRunResult {
  const databaseError = error && typeof error === 'object' ? (error as { code?: string; message?: string }) : null
  return {
    available: false,
    reason: isMissingObjectError(databaseError)
      ? `Historial no disponible: aplicar ${HEALTH_MIGRATION}.`
      : errorMessage(error),
    entries: [],
    runId: null,
    checkedAt: null,
  }
}

export async function persistReport(
  admin: SupabaseClient,
  report: HealthReport,
  triggeredBy: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const rows = report.checks.map((check) => ({
    run_id: report.runId,
    checked_at: check.checkedAt,
    check_id: check.id,
    category: check.category,
    status: check.status,
    severity: check.severity,
    message: check.summary,
    duration_ms: check.durationMs ?? null,
    // metadata ya viene saneada y sin secretos (ver buildResult).
    metadata: { name: check.name, findings: check.findings.slice(0, 10), ...(check.metadata ?? {}) },
    triggered_by: triggeredBy,
  }))
  const { error } = await admin.from('system_health_checks').insert(rows)
  if (error) {
    return {
      ok: false,
      reason: isMissingObjectError(error)
        ? `Historial desactivado: falta la tabla system_health_checks (${HEALTH_MIGRATION}).`
        : `No se pudo guardar el historial: ${errorMessage(error)}`,
    }
  }
  return { ok: true }
}

export interface HistoryFilters {
  category?: string
  status?: string
  from?: string
  to?: string
  onlyIssues?: boolean
  limit?: number
}

export async function readHistory(admin: SupabaseClient, filters: HistoryFilters = {}): Promise<HealthHistoryResult> {
  let query = admin
    .from('system_health_checks')
    .select('id, run_id, checked_at, check_id, category, status, severity, message, duration_ms')
    .order('checked_at', { ascending: false })
    .limit(Math.min(Math.max(filters.limit ?? 200, 1), 500))

  if (filters.category) query = query.eq('category', filters.category)
  if (filters.status && (HEALTH_STATUSES as string[]).includes(filters.status)) query = query.eq('status', filters.status)
  if (filters.onlyIssues && !filters.status) query = query.in('status', ['warning', 'error'])
  if (filters.from && !Number.isNaN(Date.parse(filters.from))) query = query.gte('checked_at', new Date(filters.from).toISOString())
  if (filters.to && !Number.isNaN(Date.parse(filters.to))) {
    const end = new Date(filters.to)
    end.setUTCHours(23, 59, 59, 999)
    query = query.lte('checked_at', end.toISOString())
  }

  const { data, error } = await query
  if (error) {
    return {
      available: false,
      reason: isMissingObjectError(error)
        ? `Historial no disponible: aplicar ${HEALTH_MIGRATION}.`
        : errorMessage(error),
      entries: [],
    }
  }

  return {
    available: true,
    entries: ((data ?? []) as Row[]).map(mapHistoryRow),
  }
}

export async function readPreviousRun(
  admin: SupabaseClient,
  currentRunId?: string,
): Promise<HealthPreviousRunResult> {
  try {
    let lookup = admin
      .from('system_health_checks')
      .select('id, run_id, checked_at, check_id, category, status, severity, message, duration_ms')
    if (currentRunId) lookup = lookup.neq('run_id', currentRunId)

    const { data: selected, error: lookupError } = await lookup
      .order('checked_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (lookupError) return unavailablePreviousRun(lookupError)
    if (!selected) {
      return { available: true, entries: [], runId: null, checkedAt: null }
    }

    const selectedRow = selected as Row
    const { data, error } = await admin
      .from('system_health_checks')
      .select('id, run_id, checked_at, check_id, category, status, severity, message, duration_ms')
      .eq('run_id', selectedRow.run_id)
      .order('checked_at', { ascending: false })
    if (error) return unavailablePreviousRun(error)

    return {
      available: true,
      entries: ((data ?? []) as Row[]).map(mapHistoryRow),
      runId: selectedRow.run_id,
      checkedAt: selectedRow.checked_at,
    }
  } catch (error) {
    return unavailablePreviousRun(error)
  }
}

export function summarizeHistoryRuns(entries: HealthHistoryEntry[]): HealthRunSummary[] {
  const runs = new Map<string, HealthRunSummary>()

  for (const entry of entries) {
    const existing = runs.get(entry.runId)
    if (!existing) {
      const counts = Object.fromEntries(HEALTH_STATUSES.map((status) => [status, 0])) as Record<HealthStatus, number>
      counts[entry.status] = 1
      runs.set(entry.runId, {
        runId: entry.runId,
        startedAt: entry.checkedAt,
        finishedAt: entry.checkedAt,
        durationMs: Math.max(entry.durationMs ?? 0, 0),
        checkCount: 1,
        counts,
      })
      continue
    }

    if (entry.checkedAt < existing.startedAt) existing.startedAt = entry.checkedAt
    if (entry.checkedAt > existing.finishedAt) existing.finishedAt = entry.checkedAt
    existing.durationMs += Math.max(entry.durationMs ?? 0, 0)
    existing.checkCount += 1
    existing.counts[entry.status] += 1
  }

  return [...runs.values()].sort(
    (left, right) => Date.parse(right.finishedAt) - Date.parse(left.finishedAt) || right.runId.localeCompare(left.runId),
  )
}

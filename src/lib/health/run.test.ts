import { describe, expect, it } from 'vitest'
import { sanitizeGuidedActions } from '@/lib/health/core'
import { composeOperationalReport } from '@/lib/health/run'
import type { HealthCheckResult, HealthHistoryResult } from '@/lib/health/types'

function check(id: string, status: HealthCheckResult['status']): HealthCheckResult {
  return {
    id,
    category: 'security',
    name: id,
    status,
    severity: status === 'error' ? 'critical' : 'medium',
    summary: status,
    description: 'Descripción',
    method: 'Método',
    findings: [],
    checkedAt: '2026-10-02T20:00:00.000Z',
  }
}

function compose(checks: HealthCheckResult[], previous: HealthHistoryResult) {
  return composeOperationalReport({
    runId: 'current',
    startedAt: '2026-10-02T20:00:00.000Z',
    finishedAt: '2026-10-02T20:00:01.000Z',
    target: 'https://example.com',
    environment: 'production',
    checks,
    metrics: [],
    tenantTables: [],
    previous,
  })
}

describe('composeOperationalReport', () => {
  it('compares against an available previous run and prioritizes new critical issues', () => {
    const report = compose([check('critical', 'error'), check('stable', 'healthy')], {
      available: true,
      entries: [
        { id: 1, runId: 'previous', checkedAt: '2026-10-01T20:00:00.000Z', checkId: 'critical', category: 'security', status: 'healthy', severity: 'info', message: 'ok', durationMs: 1 },
      ],
    })

    expect(report.comparison.previousRunId).toBe('previous')
    expect(report.comparison.changes[0]).toMatchObject({ checkId: 'critical', kind: 'new_issue' })
    expect(report.executiveSummary).toMatchObject({ critical: 1, newOrWorsened: 1 })
    expect(report.checks[0].id).toBe('critical')
  })

  it('stays usable and marks comparison unavailable when history fails', () => {
    const report = compose([check('uncertain', 'unknown')], {
      available: false,
      reason: 'history offline',
      entries: [],
    })

    expect(report.comparison.changes[0].kind).toBe('not_comparable')
    expect(report.scope).toMatchObject({ complete: false })
    expect(report.scope.unavailableSources).toContain('uncertain')
    expect(report.historyError).toContain('history offline')
  })
})

describe('sanitizeGuidedActions', () => {
  it('allows safe variable names, relative files, dashboards and allowlisted commands', () => {
    expect(sanitizeGuidedActions([
      { type: 'env', label: 'Configurar', target: 'UPSTASH_REDIS_REST_URL' },
      { type: 'file', label: 'Editar', target: 'src/lib/rate-limiter.ts' },
      { type: 'dashboard', label: 'Abrir', target: '/superadmin/system-health' },
      { type: 'command', label: 'Comprobar', target: 'npx supabase migration list --linked' },
    ])).toHaveLength(4)
  })

  it('rejects secret values, authorization headers, signed URLs and arbitrary commands', () => {
    expect(sanitizeGuidedActions([
      { type: 'env', label: 'Mal', target: 'TOKEN=secret-value' },
      { type: 'file', label: 'Mal', target: '../secrets.txt' },
      { type: 'documentation', label: 'Mal', target: 'https://example.com/docs?token=signed-secret' },
      { type: 'command', label: 'Mal', target: 'curl -H "Authorization: Bearer secret" https://example.com' },
    ])).toEqual([])
  })
})

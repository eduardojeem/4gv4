import { describe, expect, it } from 'vitest'
import { compareHealthChecks, prioritizeHealthChecks } from '@/lib/health/comparison'
import type { HealthCheckResult, HealthHistoryEntry, HealthSeverity, HealthStatus } from '@/lib/health/types'

const NOW = '2026-10-02T20:00:00.000Z'
const BEFORE = '2026-10-01T20:00:00.000Z'

function current(id: string, status: HealthStatus, severity: HealthSeverity = 'medium'): HealthCheckResult {
  return {
    id,
    category: 'security',
    name: id,
    status,
    severity,
    summary: `${id}: ${status}`,
    description: 'Descripción',
    method: 'Método',
    findings: [],
    checkedAt: NOW,
  }
}

function previous(id: string, status: HealthStatus, severity: HealthSeverity = 'medium'): HealthHistoryEntry {
  return {
    id: 1,
    runId: 'previous-run',
    checkedAt: BEFORE,
    checkId: id,
    category: 'security',
    status,
    severity,
    message: `${id}: ${status}`,
    durationMs: 10,
  }
}

describe('compareHealthChecks', () => {
  it.each([
    ['new', 'error', 'healthy', 'new_issue'],
    ['worse', 'error', 'warning', 'worsened'],
    ['better', 'warning', 'error', 'improved'],
    ['resolved', 'healthy', 'error', 'resolved'],
    ['same', 'warning', 'warning', 'unchanged'],
    ['uncertain', 'unknown', 'error', 'worsened'],
  ] as const)('classifies %s as %s', (id, currentStatus, previousStatus, expected) => {
    const result = compareHealthChecks(
      [current(id, currentStatus)],
      [previous(id, previousStatus)],
      'previous-run',
      BEFORE,
    )

    expect(result.changes).toEqual([
      expect.objectContaining({ checkId: id, kind: expected, currentStatus, previousStatus }),
    ])
  })

  it('marks checks without prior evidence as not comparable', () => {
    const result = compareHealthChecks([current('first', 'warning')], [], null, null)

    expect(result.previousRunId).toBeNull()
    expect(result.changes[0]).toMatchObject({ checkId: 'first', kind: 'not_comparable' })
  })

  it('counts each change kind for the executive summary', () => {
    const result = compareHealthChecks(
      [current('a', 'error', 'critical'), current('b', 'healthy'), current('c', 'warning')],
      [previous('a', 'healthy'), previous('b', 'error'), previous('c', 'warning')],
      'previous-run',
      BEFORE,
    )

    expect(result.counts).toMatchObject({ new_issue: 1, resolved: 1, unchanged: 1 })
    expect(result.executiveSummary).toMatchObject({ critical: 1, warnings: 1, newOrWorsened: 1, resolved: 1 })
  })
})

describe('prioritizeHealthChecks', () => {
  it('orders by status, severity, recent change and stable id', () => {
    const checks = [
      current('warning-old', 'warning', 'high'),
      current('error-low', 'error', 'low'),
      current('error-new', 'error', 'high'),
      current('error-old', 'error', 'high'),
    ]
    const comparison = compareHealthChecks(
      checks,
      [
        previous('warning-old', 'warning', 'high'),
        previous('error-low', 'error', 'low'),
        previous('error-new', 'healthy', 'info'),
        previous('error-old', 'error', 'high'),
      ],
      'previous-run',
      BEFORE,
    )

    expect(prioritizeHealthChecks(checks, comparison.changes).map((check) => check.id)).toEqual([
      'error-new',
      'error-old',
      'error-low',
      'warning-old',
    ])
  })
})

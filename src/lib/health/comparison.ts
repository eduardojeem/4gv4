import type {
  HealthChangeKind,
  HealthCheckChange,
  HealthCheckResult,
  HealthComparison,
  HealthHistoryEntry,
  HealthSeverity,
  HealthStatus,
} from '@/lib/health/types'

const CHANGE_KINDS: HealthChangeKind[] = [
  'new_issue',
  'worsened',
  'improved',
  'resolved',
  'unchanged',
  'not_comparable',
]

const STATUS_PRIORITY: Record<HealthStatus, number> = {
  error: 0,
  warning: 1,
  unknown: 2,
  not_configured: 3,
  healthy: 4,
}

const SEVERITY_PRIORITY: Record<HealthSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
}

const CHANGE_PRIORITY: Record<HealthChangeKind, number> = {
  new_issue: 0,
  worsened: 0,
  improved: 1,
  unchanged: 2,
  not_comparable: 3,
  resolved: 4,
}

function classifyChange(current: HealthCheckResult, previous: HealthHistoryEntry | undefined): HealthChangeKind {
  if (!previous) return 'not_comparable'
  if (current.status === previous.status) {
    if (SEVERITY_PRIORITY[current.severity] < SEVERITY_PRIORITY[previous.severity]) return 'worsened'
    if (SEVERITY_PRIORITY[current.severity] > SEVERITY_PRIORITY[previous.severity]) return 'improved'
    return 'unchanged'
  }
  if (current.status === 'healthy') return 'resolved'
  if (previous.status === 'healthy' && (current.status === 'warning' || current.status === 'error')) return 'new_issue'
  if (
    (current.status === 'unknown' || current.status === 'not_configured') &&
    (previous.status === 'warning' || previous.status === 'error')
  ) {
    return 'worsened'
  }

  const currentRank = STATUS_PRIORITY[current.status]
  const previousRank = STATUS_PRIORITY[previous.status]
  return currentRank < previousRank ? 'worsened' : 'improved'
}

export function compareHealthChecks(
  current: HealthCheckResult[],
  previous: HealthHistoryEntry[],
  previousRunId: string | null,
  previousCheckedAt: string | null,
): HealthComparison {
  const previousById = new Map(previous.map((entry) => [entry.checkId, entry]))
  const changes = current.map((check): HealthCheckChange => {
    const prior = previousById.get(check.id)
    return {
      checkId: check.id,
      kind: classifyChange(check, prior),
      currentStatus: check.status,
      previousStatus: prior?.status ?? null,
      currentSeverity: check.severity,
      previousSeverity: prior?.severity ?? null,
    }
  })
  const counts = Object.fromEntries(CHANGE_KINDS.map((kind) => [kind, 0])) as Record<HealthChangeKind, number>
  for (const change of changes) counts[change.kind] += 1

  return {
    previousRunId,
    previousCheckedAt,
    changes,
    counts,
    executiveSummary: {
      critical: current.filter((check) => check.status !== 'healthy' && check.severity === 'critical').length,
      warnings: current.filter((check) => check.status === 'warning').length,
      newOrWorsened: counts.new_issue + counts.worsened,
      resolved: counts.resolved,
    },
  }
}

export function prioritizeHealthChecks(
  checks: HealthCheckResult[],
  changes: HealthCheckChange[],
): HealthCheckResult[] {
  const changesById = new Map(changes.map((change) => [change.checkId, change.kind]))
  return [...checks].sort((left, right) => {
    return (
      STATUS_PRIORITY[left.status] - STATUS_PRIORITY[right.status] ||
      SEVERITY_PRIORITY[left.severity] - SEVERITY_PRIORITY[right.severity] ||
      CHANGE_PRIORITY[changesById.get(left.id) ?? 'not_comparable'] -
        CHANGE_PRIORITY[changesById.get(right.id) ?? 'not_comparable'] ||
      left.id.localeCompare(right.id)
    )
  })
}

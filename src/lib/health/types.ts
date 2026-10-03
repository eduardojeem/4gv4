/**
 * Contratos del centro de diagnóstico (/superadmin/system-health).
 *
 * Capas:  UI (client)  →  server action  →  runSystemHealth()  →  checks/*
 * Nada de este directorio debe importarse desde un Client Component salvo
 * los tipos: los checks usan la service role y variables privadas.
 */

/**
 * - healthy:        comprobado y correcto.
 * - warning:        comprobado, funciona pero hay algo a corregir.
 * - error:          comprobado y falla.
 * - not_configured: la integración o el recurso no existe/no está configurado.
 * - unknown:        no se pudo verificar automáticamente (falta integración,
 *                   requiere revisión manual o la fuente no respondió).
 *                   Nunca cuenta como aprobado.
 */
export type HealthStatus = 'healthy' | 'warning' | 'error' | 'not_configured' | 'unknown'

export type HealthSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export type HealthChangeKind =
  | 'new_issue'
  | 'worsened'
  | 'improved'
  | 'resolved'
  | 'unchanged'
  | 'not_comparable'

export type HealthCategory =
  | 'legal'
  | 'security'
  | 'seo'
  | 'performance'
  | 'ux'
  | 'supabase'
  | 'tenancy'
  | 'storage'
  | 'auth'
  | 'payments'
  | 'webhooks'
  | 'analytics'
  | 'cloudflare'
  | 'deployment'

export interface HealthCheckResult {
  id: string
  category: HealthCategory
  name: string
  status: HealthStatus
  severity: HealthSeverity
  /** Una línea: qué se encontró. */
  summary: string
  /** Qué mide esta comprobación y por qué importa. */
  description: string
  /** Cómo se comprobó (fuente real). */
  method: string
  /** Hallazgos concretos, p. ej. "Falta meta description en /register". */
  findings: string[]
  recommendation?: string
  durationMs?: number
  checkedAt: string
  /** Datos adicionales seguros (nunca secretos). */
  metadata?: Record<string, string | number | boolean | null>
  guidedActions?: HealthGuidedAction[]
}

export interface HealthGuidedAction {
  type: 'file' | 'env' | 'command' | 'dashboard' | 'documentation'
  label: string
  target: string
  description?: string
}

export interface HealthCheckChange {
  checkId: string
  kind: HealthChangeKind
  currentStatus: HealthStatus
  previousStatus: HealthStatus | null
  currentSeverity: HealthSeverity
  previousSeverity: HealthSeverity | null
}

export interface ExecutiveHealthSummary {
  critical: number
  warnings: number
  newOrWorsened: number
  resolved: number
}

export interface HealthComparison {
  previousRunId: string | null
  previousCheckedAt: string | null
  changes: HealthCheckChange[]
  counts: Record<HealthChangeKind, number>
  executiveSummary: ExecutiveHealthSummary
}

export interface HealthMetric {
  label: string
  value: string | number | null
  /** Cuando value es null: por qué no hay dato y qué haría falta. */
  unavailableReason?: string
}

export interface HealthMetricGroup {
  id: string
  title: string
  metrics: HealthMetric[]
  rows?: Array<{ label: string; value: string | number; hint?: string }>
}

export type ServiceConfigurationState = 'configured' | 'partial' | 'missing'

export interface ServiceHealthEntry {
  id: string
  name: string
  status: HealthStatus
  configured: ServiceConfigurationState
  summary: string
  source: string
  checkedAt: string | null
}

export interface ScheduledTaskHealth {
  id: string
  name: string
  status: HealthStatus
  summary: string
  source: string
  lastRunAt: string | null
  nextRunAt: string | null
  durationMs: number | null
}

export interface TenantTableFinding {
  table: string
  status: HealthStatus
  severity: HealthSeverity
  reasons: string[]
}

export interface HealthReport {
  runId: string
  startedAt: string
  finishedAt: string
  durationMs: number
  target: string
  environment: string
  checks: HealthCheckResult[]
  metrics: HealthMetricGroup[]
  tenantTables: TenantTableFinding[]
  counts: Record<HealthStatus, number>
  overall: HealthStatus
  comparison: HealthComparison
  executiveSummary: ExecutiveHealthSummary
  deployment: HealthMetricGroup | null
  serviceHealth: ServiceHealthEntry[]
  scheduledTasks: ScheduledTaskHealth[]
  scope: {
    complete: boolean
    unavailableSources: string[]
  }
  historyPersisted: boolean
  historyError?: string
}

export interface HealthHistoryEntry {
  id: number
  runId: string
  checkedAt: string
  checkId: string
  category: HealthCategory
  status: HealthStatus
  severity: HealthSeverity
  message: string
  durationMs: number | null
}

export interface HealthHistoryResult {
  available: boolean
  reason?: string
  entries: HealthHistoryEntry[]
}

export const HEALTH_STATUSES: HealthStatus[] = ['healthy', 'warning', 'error', 'not_configured', 'unknown']
export const HEALTH_SEVERITIES: HealthSeverity[] = ['critical', 'high', 'medium', 'low', 'info']

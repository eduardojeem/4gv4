import { createAdminSupabase } from '@/lib/supabase/admin'
import { logSuperAdminAction } from '@/lib/superadmin/audit'

/**
 * Tareas de mantenimiento de la plataforma. Todas registran quién las ejecutó
 * en audit_log con acciones `maintenance.*`, que es de donde sale el historial.
 *
 * La rotación de auditoría es irreversible: solo se permite conservar al menos
 * 90 días (decisión del 2026-09-27) y el registro de la propia rotación se
 * escribe DESPUÉS del borrado, así nunca se elimina a sí mismo.
 */
export const AUDIT_RETENTION_OPTIONS = [90, 180, 365] as const
export type AuditRetentionDays = (typeof AUDIT_RETENTION_OPTIONS)[number]

export const MAINTENANCE_ACTIONS = {
  rotateAuditLog: 'maintenance.rotate_audit_log',
  resetDatabaseStats: 'maintenance.reset_db_stats',
  deleteOrphanImages: 'maintenance.delete_orphan_images',
} as const

/** Nombres usados antes de esta versión; se muestran en el historial igual. */
const LEGACY_ACTIONS = ['rotate_audit_logs', 'maintenance_task', 'reset_stats', 'storage_cleanup']

export function isAuditRetentionDays(value: number): value is AuditRetentionDays {
  return (AUDIT_RETENTION_OPTIONS as readonly number[]).includes(value)
}

function cutoffFor(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

export interface MaintenanceActor {
  id: string
  email?: string | null
}

export async function countAuditOlderThan(days: AuditRetentionDays): Promise<number> {
  const admin = createAdminSupabase()
  const { count, error } = await admin
    .from('audit_log')
    .select('id', { count: 'exact', head: true })
    .lt('created_at', cutoffFor(days))
  if (error) throw new Error(`No se pudo contar la auditoría: ${error.message}`)
  return count ?? 0
}

export async function rotateAuditLog(days: AuditRetentionDays, actor: MaintenanceActor, request?: Request) {
  const admin = createAdminSupabase()
  const { error, count } = await admin
    .from('audit_log')
    .delete({ count: 'exact' })
    .lt('created_at', cutoffFor(days))
  if (error) throw new Error(`No se pudo rotar la auditoría: ${error.message}`)

  const deletedCount = count ?? 0
  await logSuperAdminAction({
    actorId: actor.id,
    actorEmail: actor.email,
    action: MAINTENANCE_ACTIONS.rotateAuditLog,
    resource: 'audit_log',
    newValues: { retention_days: days, deleted_count: deletedCount },
    severity: 'high',
    request,
  })
  return { deletedCount }
}

export async function resetDatabaseStats(actor: MaintenanceActor, request?: Request) {
  const admin = createAdminSupabase()
  const { error } = await admin.rpc('perform_maintenance_task', { task_name: 'reset_stats' })
  if (error) throw new Error(`No se pudieron reiniciar las estadísticas: ${error.message}`)
  await logSuperAdminAction({
    actorId: actor.id,
    actorEmail: actor.email,
    action: MAINTENANCE_ACTIONS.resetDatabaseStats,
    resource: 'database',
    severity: 'medium',
    request,
  })
}

export interface MaintenanceHistoryEntry {
  id: string
  action: string
  createdAt: string | null
  actorEmail: string | null
  details: Record<string, unknown> | null
}

export interface MaintenanceOverview {
  audit: {
    total: number
    last30Days: number
    olderThan: Record<AuditRetentionDays, number>
    oldest: string | null
  }
  history: MaintenanceHistoryEntry[]
  loadErrors: string[]
}

export async function getMaintenanceOverview(): Promise<MaintenanceOverview> {
  const admin = createAdminSupabase()
  const head = () => admin.from('audit_log').select('id', { count: 'exact', head: true })
  const [total, recent, d90, d180, d365, oldest, history] = await Promise.all([
    head(),
    head().gte('created_at', cutoffFor(30)),
    head().lt('created_at', cutoffFor(90)),
    head().lt('created_at', cutoffFor(180)),
    head().lt('created_at', cutoffFor(365)),
    admin.from('audit_log').select('created_at').order('created_at', { ascending: true }).limit(1).maybeSingle(),
    admin
      .from('audit_log')
      .select('id, action, created_at, user_id, new_values')
      .in('action', [...Object.values(MAINTENANCE_ACTIONS), ...LEGACY_ACTIONS])
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const loadErrors = [total, recent, d90, d180, d365, history]
    .map((r) => r.error?.message)
    .filter((m): m is string => Boolean(m))

  const historyRows = (history.data ?? []) as Array<{ id: string; action: string; created_at: string | null; user_id: string | null; new_values: unknown }>
  const userIds = [...new Set(historyRows.map((r) => r.user_id).filter((id): id is string => Boolean(id)))]
  const emails = new Map<string, string | null>()
  if (userIds.length > 0) {
    const { data } = await admin.from('profiles').select('id, email').in('id', userIds)
    for (const p of (data ?? []) as Array<{ id: string; email: string | null }>) emails.set(p.id, p.email)
  }

  return {
    audit: {
      total: total.count ?? 0,
      last30Days: recent.count ?? 0,
      olderThan: { 90: d90.count ?? 0, 180: d180.count ?? 0, 365: d365.count ?? 0 },
      oldest: (oldest.data as { created_at?: string } | null)?.created_at ?? null,
    },
    history: historyRows.map((r) => ({
      id: r.id,
      action: r.action,
      createdAt: r.created_at,
      actorEmail: r.user_id ? emails.get(r.user_id) ?? null : null,
      details: r.new_values && typeof r.new_values === 'object' ? (r.new_values as Record<string, unknown>) : null,
    })),
    loadErrors,
  }
}

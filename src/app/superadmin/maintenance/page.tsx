import { createAdminSupabase } from '@/lib/supabase/admin'
import { MaintenanceDashboard, type MaintenanceData } from '@/components/superadmin/MaintenanceDashboard'

async function getMaintenanceData(): Promise<MaintenanceData> {
  const admin = createAdminSupabase()

  const now = Date.now()
  const cutoffs = {
    d30: new Date(now - 30 * 86400000).toISOString(),
    d60: new Date(now - 60 * 86400000).toISOString(),
    d90: new Date(now - 90 * 86400000).toISOString(),
    d180: new Date(now - 180 * 86400000).toISOString(),
  }

  const [
    auditTotalRes,
    audit30Res, audit60Res, audit90Res, audit180Res,
    auditRecentRes,
    canceledSubsRes,
    inactiveOrgsRes,
  ] = await Promise.all([
    admin.from('audit_log').select('id', { count: 'exact', head: true }),
    admin.from('audit_log').select('id', { count: 'exact', head: true }).lt('created_at', cutoffs.d30),
    admin.from('audit_log').select('id', { count: 'exact', head: true }).lt('created_at', cutoffs.d60),
    admin.from('audit_log').select('id', { count: 'exact', head: true }).lt('created_at', cutoffs.d90),
    admin.from('audit_log').select('id', { count: 'exact', head: true }).lt('created_at', cutoffs.d180),
    admin.from('audit_log').select('id', { count: 'exact', head: true }).gte('created_at', cutoffs.d30),
    admin.from('subscriptions').select('id', { count: 'exact', head: true }).in('status', ['canceled', 'cancelled', 'expired']),
    admin.from('organizations').select('id', { count: 'exact', head: true }).lt('updated_at', cutoffs.d90),
  ])

  // Audit log mantenimiento history (acciones tipo 'maintenance' o 'rotate_logs')
  const { data: maintenanceHistory } = await admin
    .from('audit_log')
    .select('id, action, created_at, new_values, user_id, severity')
    .or('action.eq.rotate_audit_logs,action.eq.maintenance_task,action.eq.reset_stats,action.eq.storage_cleanup')
    .order('created_at', { ascending: false })
    .limit(10)

  return {
    audit: {
      total: auditTotalRes.count ?? 0,
      recent: auditRecentRes.count ?? 0,
      olderThan30: audit30Res.count ?? 0,
      olderThan60: audit60Res.count ?? 0,
      olderThan90: audit90Res.count ?? 0,
      olderThan180: audit180Res.count ?? 0,
    },
    cleanup: {
      canceledSubscriptions: canceledSubsRes.count ?? 0,
      inactiveOrgs: inactiveOrgsRes.count ?? 0,
    },
    history: ((maintenanceHistory ?? []) as Array<{
      id: string; action: string; created_at: string | null; new_values: unknown; user_id: string | null; severity: string | null
    }>).map((h) => ({
      id: h.id,
      action: h.action,
      createdAt: h.created_at,
      payload: h.new_values,
      userId: h.user_id,
      severity: h.severity,
    })),
    fetchedAt: new Date().toISOString(),
  }
}

export default async function SuperAdminMaintenancePage() {
  const data = await getMaintenanceData()
  return <MaintenanceDashboard data={data} />
}

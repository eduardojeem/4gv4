import { createAdminSupabase } from '@/lib/supabase/admin'
import { AuditLogsDashboard, type AuditLogRow } from '@/components/superadmin/AuditLogsDashboard'

async function getAuditLogsData() {
  const admin = createAdminSupabase()

  const { data: logsData } = await admin
    .from('audit_log')
    .select('id, user_id, action, resource, resource_id, severity, ip_address, user_agent, created_at, details, new_values, old_values')
    .order('created_at', { ascending: false })
    .limit(1000)

  const logs = (logsData ?? []) as Array<{
    id: string; user_id: string | null; action: string; resource: string; resource_id: string | null
    severity: string | null; ip_address: string | null; user_agent: string | null; created_at: string | null
    details: unknown; new_values: unknown; old_values: unknown
  }>

  // Cruzar con profiles
  const userIds = Array.from(new Set(logs.map((l) => l.user_id).filter(Boolean))) as string[]
  let profilesById = new Map<string, { email: string | null; full_name: string | null }>()
  if (userIds.length > 0) {
    const { data: profiles } = await admin.from('profiles').select('id, email, full_name').in('id', userIds)
    profilesById = new Map(
      ((profiles ?? []) as Array<{ id: string; email: string | null; full_name: string | null }>)
        .map((p) => [p.id, { email: p.email, full_name: p.full_name }])
    )
  }

  // Cruzar con organizations si el resource_id apunta a una org
  const orgRefIds = Array.from(new Set(
    logs
      .filter((l) => l.resource === 'organizations' && l.resource_id)
      .map((l) => l.resource_id as string)
  ))
  let orgsById = new Map<string, { name: string; slug: string }>()
  if (orgRefIds.length > 0) {
    const { data: orgs } = await admin.from('organizations').select('id, name, slug').in('id', orgRefIds)
    orgsById = new Map(
      ((orgs ?? []) as Array<{ id: string; name: string; slug: string }>)
        .map((o) => [o.id, { name: o.name, slug: o.slug }])
    )
  }

  const rows: AuditLogRow[] = logs.map((l) => {
    const profile = l.user_id ? profilesById.get(l.user_id) : null
    const org = l.resource === 'organizations' && l.resource_id ? orgsById.get(l.resource_id) : null
    return {
      id: l.id,
      userId: l.user_id,
      userEmail: profile?.email ?? null,
      userName: profile?.full_name ?? null,
      action: l.action,
      resource: l.resource,
      resourceId: l.resource_id,
      severity: (l.severity ?? 'low') as 'low' | 'medium' | 'high' | 'critical',
      ipAddress: l.ip_address,
      userAgent: l.user_agent,
      createdAt: l.created_at,
      details: l.details,
      newValues: l.new_values,
      oldValues: l.old_values,
      resourceName: org?.name ?? null,
      resourceSlug: org?.slug ?? null,
    }
  })

  return rows
}

export default async function SuperAdminAuditLogsPage() {
  const rows = await getAuditLogsData()
  return <AuditLogsDashboard rows={rows} />
}

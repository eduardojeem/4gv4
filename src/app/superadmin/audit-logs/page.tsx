import { createAdminSupabase } from '@/lib/supabase/admin'
import { AuditLogsDashboard, type AuditLogRow } from '@/components/superadmin/AuditLogsDashboard'

export const revalidate = 60

const ALLOWED_SEVERITY = new Set(['low', 'medium', 'high', 'critical'])

function normalizeSeverity(value: string | null): AuditLogRow['severity'] {
  if (value && ALLOWED_SEVERITY.has(value)) return value as AuditLogRow['severity']
  if (value === 'warning') return 'medium'
  if (value === 'error') return 'high'
  return 'low'
}

function detailsOrgId(details: unknown): string | null {
  if (details && typeof details === 'object') {
    const value = (details as Record<string, unknown>).organization_id
    if (typeof value === 'string' && value) return value
  }
  return null
}

function sinceForPeriod(period: string): string {
  const now = Date.now()
  const ms: Record<string, number> = {
    '1h':  60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d':  7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  }
  return new Date(now - (ms[period] ?? ms['7d'])).toISOString()
}

const PAGE_SIZE = 20

async function getAuditLogsData(period: string, severity: string, page: number) {
  const admin = createAdminSupabase()
  const since = sinceForPeriod(period)
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = admin
    .from('audit_log')
    .select('id, user_id, action, resource, resource_id, severity, ip_address, user_agent, created_at, details', { count: 'exact' })
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (severity && ALLOWED_SEVERITY.has(severity)) {
    query = query.eq('severity', severity)
  }

  const { data: logsData, count: logsCount } = await query

  const logs = (logsData ?? []) as Array<{
    id: string; user_id: string | null; action: string; resource: string; resource_id: string | null
    severity: string | null; ip_address: string | null; user_agent: string | null; created_at: string | null
    details: unknown
  }>

  const userIds = Array.from(new Set(logs.map((l) => l.user_id).filter(Boolean))) as string[]
  let profilesById = new Map<string, { email: string | null; full_name: string | null }>()
  if (userIds.length > 0) {
    const { data: profiles } = await admin.from('profiles').select('id, email, full_name').in('id', userIds)
    profilesById = new Map(
      ((profiles ?? []) as Array<{ id: string; email: string | null; full_name: string | null }>)
        .map((p) => [p.id, { email: p.email, full_name: p.full_name }])
    )
  }

  const orgIds = new Set<string>()
  logs.forEach((l) => {
    if (l.resource === 'organizations' && l.resource_id) orgIds.add(l.resource_id)
    const detailOrg = detailsOrgId(l.details)
    if (detailOrg) orgIds.add(detailOrg)
  })
  let orgsById = new Map<string, { name: string; slug: string }>()
  if (orgIds.size > 0) {
    const { data: orgs } = await admin.from('organizations').select('id, name, slug').in('id', Array.from(orgIds))
    orgsById = new Map(
      ((orgs ?? []) as Array<{ id: string; name: string; slug: string }>)
        .map((o) => [o.id, { name: o.name, slug: o.slug }])
    )
  }

  const rows: AuditLogRow[] = logs.map((l) => {
    const profile = l.user_id ? profilesById.get(l.user_id) : null
    const orgId = l.resource === 'organizations' && l.resource_id ? l.resource_id : detailsOrgId(l.details)
    const org = orgId ? orgsById.get(orgId) : null
    return {
      id: l.id,
      userId: l.user_id,
      userEmail: profile?.email ?? null,
      userName: profile?.full_name ?? null,
      action: l.action,
      resource: l.resource,
      resourceId: l.resource_id,
      severity: normalizeSeverity(l.severity),
      ipAddress: l.ip_address,
      userAgent: l.user_agent,
      createdAt: l.created_at,
      details: l.details,
      resourceName: org?.name ?? null,
      resourceSlug: org?.slug ?? null,
    }
  })

  return { rows, total: logsCount ?? 0 }
}

export default async function SuperAdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const period = ['1h', '24h', '7d', '30d'].includes(params.period ?? '') ? (params.period as string) : '7d'
  const severity = ALLOWED_SEVERITY.has(params.severity ?? '') ? (params.severity as string) : ''
  const page = Math.max(0, Number(params.page ?? 0))
  const { rows, total } = await getAuditLogsData(period, severity, page)
  return (
    <AuditLogsDashboard
      rows={rows}
      period={period}
      severityParam={severity}
      page={page}
      pageSize={PAGE_SIZE}
      total={total}
    />
  )
}

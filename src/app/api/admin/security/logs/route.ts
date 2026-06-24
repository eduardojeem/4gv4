import { NextRequest, NextResponse } from 'next/server'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { createAdminSupabase } from '@/lib/supabase/admin'

type Severity = 'low' | 'medium' | 'high' | 'critical'

type AuditLogRow = {
  id: string
  user_id: string | null
  action: string
  resource: string | null
  resource_id: string | null
  details: unknown
  new_values: unknown
  ip_address: string | null
  user_agent: string | null
  created_at: string | null
  severity: string | null
  organization_id?: string | null
}

type SecurityLog = {
  id: string
  event: string
  user: string
  timestamp: string
  ip: string
  severity: Severity
  details?: string
  user_id?: string
  action?: string
  resource?: string
  resource_id?: string
  user_agent?: string
}

const EVENT_MAP: Record<string, { event: string; severity: Severity }> = {
  admin_api_access: { event: 'Acceso administrativo', severity: 'low' },
  unauthorized_admin_access_attempt: { event: 'Intento de acceso admin no autorizado', severity: 'high' },
  create: { event: 'Creacion de registro', severity: 'low' },
  update: { event: 'Actualizacion de registro', severity: 'low' },
  delete: { event: 'Eliminacion de registro', severity: 'medium' },
  login: { event: 'Inicio de sesion exitoso', severity: 'low' },
  login_failed: { event: 'Intento de acceso fallido', severity: 'medium' },
  logout: { event: 'Cierre de sesion', severity: 'low' },
  password_change: { event: 'Cambio de contrasena', severity: 'low' },
  role_change: { event: 'Cambio de rol de usuario', severity: 'high' },
  grant_admin_self_rpc: { event: 'Auto-promocion a administrador', severity: 'critical' },
  grant_admin_migration: { event: 'Promocion a administrador', severity: 'high' },
  permission_denied: { event: 'Acceso denegado', severity: 'medium' },
  suspicious_activity: { event: 'Actividad sospechosa detectada', severity: 'high' },
  data_export: { event: 'Exportacion de datos', severity: 'medium' },
  bulk_operation: { event: 'Operacion masiva', severity: 'medium' },
  update_user_status: { event: 'Cambio de estado de usuario', severity: 'high' },
}

const SELECT_COLUMNS_WITH_ORG = 'id, user_id, action, resource, resource_id, details, new_values, ip_address, user_agent, created_at, severity, organization_id'
const SELECT_COLUMNS_LEGACY = 'id, user_id, action, resource, resource_id, details, new_values, ip_address, user_agent, created_at, severity'

function timeRangeToDate(value: string | null) {
  const now = Date.now()
  const hours = value === '1h' ? 1 : value === '7d' ? 168 : value === '30d' ? 720 : 24
  return new Date(now - hours * 60 * 60 * 1000).toISOString()
}

function normalizeSeverity(value: unknown, fallback: Severity): Severity {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'critical' ? value : fallback
}

function severityDbValues(value: string | null) {
  if (!value || value === 'all') return null
  if (value === 'low') return ['low', 'info']
  if (value === 'medium' || value === 'high' || value === 'critical') return [value]
  return null
}

function stringifyDetails(value: unknown) {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  const keys = ['path', 'method', 'status', 'reason', 'organization_id']
  const pairs = keys
    .filter((key) => record[key] !== undefined && record[key] !== null)
    .map((key) => `${key}: ${String(record[key])}`)

  return pairs.length > 0 ? pairs.join(' - ') : undefined
}

function buildDetails(row: AuditLogRow) {
  const detail = stringifyDetails(row.details) || stringifyDetails(row.new_values)
  const resource = row.resource || 'sistema'
  const suffix = row.resource_id ? ` (${row.resource_id})` : ''

  return detail ? `${resource}${suffix} - ${detail}` : `${resource}${suffix}`
}

function organizationFromPayload(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  return typeof record.organization_id === 'string' ? record.organization_id : null
}

function rowBelongsToOrganization(row: AuditLogRow, organizationId: string, organizationUserIds: Set<string>) {
  const payloadOrg = row.organization_id || organizationFromPayload(row.new_values) || organizationFromPayload(row.details)
  return payloadOrg === organizationId || Boolean(row.user_id && organizationUserIds.has(row.user_id))
}

function computeStats(logs: SecurityLog[], totalEvents: number) {
  const uniqueUsers = new Set<string>()
  const uniqueIPs = new Set<string>()

  for (const log of logs) {
    if (log.user && log.user !== 'Sistema') uniqueUsers.add(log.user)
    if (log.ip && log.ip !== 'N/A') uniqueIPs.add(log.ip)
  }

  return {
    totalEvents,
    criticalEvents: logs.filter((log) => log.severity === 'critical').length,
    highRiskEvents: logs.filter((log) => log.severity === 'high').length,
    failedAttempts: logs.filter((log) => log.action?.includes('failed') || log.action === 'permission_denied').length,
    uniqueUsers: uniqueUsers.size,
    uniqueIPs: uniqueIPs.size,
  }
}

async function loadOrganizationUserIds(admin: ReturnType<typeof createAdminSupabase>, organizationId: string) {
  const { data, error } = await admin
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', organizationId)

  if (error) throw error
  return new Set((data || []).map((member) => member.user_id).filter(Boolean))
}

async function loadProfiles(admin: ReturnType<typeof createAdminSupabase>, userIds: string[]) {
  const profilesById = new Map<string, string>()

  if (userIds.length === 0) return profilesById

  const { data } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .in('id', userIds)

  for (const profile of data || []) {
    const name = profile.full_name || ''
    const email = profile.email || ''
    profilesById.set(profile.id, name && email ? `${name} (${email})` : name || email || 'Usuario desconocido')
  }

  return profilesById
}

function mapLog(row: AuditLogRow, profilesById: Map<string, string>): SecurityLog {
  const mapped = EVENT_MAP[row.action] || { event: `Accion: ${row.action}`, severity: 'low' as Severity }

  return {
    id: row.id,
    event: mapped.event,
    user: row.user_id ? profilesById.get(row.user_id) || 'Usuario desconocido' : 'Sistema',
    timestamp: row.created_at || new Date().toISOString(),
    ip: row.ip_address || 'N/A',
    severity: normalizeSeverity(row.severity, mapped.severity),
    details: buildDetails(row),
    user_id: row.user_id || undefined,
    action: row.action,
    resource: row.resource || undefined,
    resource_id: row.resource_id || undefined,
    user_agent: row.user_agent || undefined,
  }
}

function applyBaseFilters(query: any, params: {
  startDate: string
  severity: string | null
  search: string
  userId: string | null
}) {
  const severityValues = severityDbValues(params.severity)
  let nextQuery = query.gte('created_at', params.startDate)

  if (severityValues?.length) {
    nextQuery = nextQuery.in('severity', severityValues)
  }

  if (params.userId && params.userId !== 'all') {
    nextQuery = nextQuery.eq('user_id', params.userId)
  }

  if (params.search) {
    const escaped = params.search.replace(/[%_,]/g, '\\$&')
    nextQuery = nextQuery.or([
      `action.ilike.%${escaped}%`,
      `resource.ilike.%${escaped}%`,
      `resource_id.ilike.%${escaped}%`,
      `ip_address.ilike.%${escaped}%`,
      `user_agent.ilike.%${escaped}%`,
    ].join(','))
  }

  return nextQuery
}

export async function GET(request: NextRequest) {
  const auth = await resolveRequestAuthUser()

  if ('reason' in auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let organizationId: string | null = null

  if (auth.user.role !== 'super_admin') {
    const organization = await getCurrentOrganizationContext(auth.user.id)

    if (!organization || !['owner', 'admin'].includes(organization.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    organizationId = organization.id
  }

  const { searchParams } = request.nextUrl
  const timeRange = searchParams.get('timeRange')
  const severity = searchParams.get('severity')
  const search = (searchParams.get('search') || '').trim()
  const userId = searchParams.get('userId')
  const page = Math.max(1, Number(searchParams.get('page') || 1))
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get('pageSize') || searchParams.get('limit') || 20)))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const startDate = timeRangeToDate(timeRange)
  const admin = createAdminSupabase()

  let organizationUserIds: Set<string> | null = null
  if (organizationId) {
    try {
      organizationUserIds = await loadOrganizationUserIds(admin, organizationId)
    } catch {
      return NextResponse.json({ error: 'No se pudieron cargar los miembros de la organizacion.' }, { status: 500 })
    }
  }

  const runQuery = async (withOrganizationColumn: boolean) => {
    let query = applyBaseFilters(
      admin
        .from('audit_log')
        .select(withOrganizationColumn ? SELECT_COLUMNS_WITH_ORG : SELECT_COLUMNS_LEGACY, { count: 'exact' }),
      { startDate, severity, search, userId }
    )

    if (organizationId && withOrganizationColumn) {
      query = query.eq('organization_id', organizationId)
    } else if (organizationId && organizationUserIds && organizationUserIds.size > 0) {
      query = query.in('user_id', Array.from(organizationUserIds))
    }

    return query.order('created_at', { ascending: false }).range(from, to)
  }

  let response = await runQuery(true)
  if (response.error && /organization_id/i.test(response.error.message || '')) {
    response = await runQuery(false)
  }

  if (response.error) {
    return NextResponse.json({ error: response.error.message || 'No se pudieron cargar los eventos de seguridad.' }, { status: 500 })
  }

  const rawRows = ((response.data || []) as AuditLogRow[])
  const scopedRows = organizationId && organizationUserIds
    ? rawRows.filter((row) => rowBelongsToOrganization(row, organizationId, organizationUserIds))
    : rawRows

  const userIds = Array.from(new Set(scopedRows.map((row) => row.user_id).filter(Boolean))) as string[]
  const profileUserIds = organizationUserIds
    ? Array.from(new Set([...Array.from(organizationUserIds), ...userIds]))
    : userIds
  const profilesById = await loadProfiles(admin, profileUserIds)
  const logs = scopedRows.map((row) => mapLog(row, profilesById))
  const totalCount = response.count ?? logs.length

  const users = organizationUserIds
    ? Array.from(organizationUserIds)
      .map((id) => ({ id, name: profilesById.get(id) || 'Usuario desconocido' }))
      .sort((a, b) => a.name.localeCompare(b.name))
    : Array.from(
      new Map(
        logs
          .filter((log) => log.user_id)
          .map((log) => [log.user_id as string, { id: log.user_id as string, name: log.user }])
      ).values()
    ).sort((a, b) => a.name.localeCompare(b.name))

  return NextResponse.json({
    logs,
    stats: computeStats(logs, totalCount),
    totalCount,
    page,
    pageSize,
    users,
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { createAdminSupabase } from '@/lib/supabase/admin'
import {
  actionsWithSeverity,
  describeAuditEvent,
  isAuditSeverity,
  severityColumnValues,
} from '@/lib/security/audit-events'

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


/**
 * Tope de la exportacion. Existe para no armar un archivo de cientos de miles de
 * filas en memoria; cuando se alcanza, la respuesta lo dice para que la pantalla
 * pueda avisar en vez de entregar un recorte silencioso.
 */
const EXPORT_MAX_ROWS = 5000

const SELECT_COLUMNS_WITH_ORG = 'id, user_id, action, resource, resource_id, details, new_values, ip_address, user_agent, created_at, severity, organization_id'
const SELECT_COLUMNS_LEGACY = 'id, user_id, action, resource, resource_id, details, new_values, ip_address, user_agent, created_at, severity'

function timeRangeToDate(value: string | null) {
  const now = Date.now()
  const hours = value === '1h' ? 1 : value === '7d' ? 168 : value === '30d' ? 720 : 24
  return new Date(now - hours * 60 * 60 * 1000).toISOString()
}

function normalizeSeverity(value: unknown, fallback: Severity): Severity {
  return isAuditSeverity(value) ? value : fallback
}

/**
 * Filtro de gravedad que alcanza tambien las filas sin severidad guardada.
 *
 * Solo el registro de superadmin completa la columna: todo lo que escribe la
 * aplicacion la deja en null. La pantalla deduce la gravedad del catalogo para
 * mostrarla, asi que filtrando unicamente por la columna el resultado era
 * siempre vacio — justo para los eventos graves, que es para lo que se usa.
 *
 * Se buscan las dos cosas: la columna cuando esta escrita, y la accion cuando
 * no. Los nombres de accion salen del catalogo, no del usuario.
 */
function severityFilterExpression(value: string | null): string | null {
  if (!value || value === 'all' || !isAuditSeverity(value)) return null

  const columnValues = severityColumnValues(value).join(',')
  const actions = actionsWithSeverity(value)
  const porColumna = `severity.in.(${columnValues})`

  if (actions.length === 0) return porColumna

  return `${porColumna},and(severity.is.null,action.in.(${actions.join(',')}))`
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
  const mapped = describeAuditEvent(row.action)

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
  const severityExpression = severityFilterExpression(params.severity)
  let nextQuery = query.gte('created_at', params.startDate)

  if (severityExpression) {
    nextQuery = nextQuery.or(severityExpression)
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

  // La exportacion pide el rango filtrado completo, no la pagina visible. El
  // boton exportaba las veinte filas cargadas mientras el aviso decia "con los
  // filtros actuales", asi que quien guardaba evidencia se llevaba una pagina.
  const isExport = searchParams.get('mode') === 'export'
  const maxPageSize = isExport ? EXPORT_MAX_ROWS : 100
  const requestedSize = Number(searchParams.get('pageSize') || searchParams.get('limit') || (isExport ? EXPORT_MAX_ROWS : 20))
  const pageSize = Math.min(maxPageSize, Math.max(10, requestedSize))
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
    // Solo importa al exportar: dice si quedaron eventos fuera del archivo.
    truncated: isExport && totalCount > logs.length,
  })
}

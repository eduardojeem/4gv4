import { NextRequest, NextResponse } from 'next/server'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { getOrganizationPlanInfo } from '@/lib/saas/subscription-service'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { sanitizeFilterTerm } from '@/lib/api/sanitize-search'
import {
  type AuditSeverity,
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

/** Acciones que cuentan como intento fallido en la tarjeta de la pantalla. */
const FAILED_ATTEMPT_ACTIONS = ['login_failed', 'permission_denied', 'unauthorized_admin_access_attempt']

const SELECT_COLUMNS_WITH_ORG = 'id, user_id, action, resource, resource_id, details, new_values, ip_address, user_agent, created_at, severity, organization_id'

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

/**
 * Los tres numeros que muestra la pantalla, contados sobre TODO el rango.
 *
 * Antes salian de `logs`, o sea de las veinte filas de la pagina, mientras
 * "eventos totales" venia del conteo completo: en la misma fila convivian un
 * total real y tres parciales que parecian totales. Con doce eventos criticos
 * repartidos en seis paginas, la tarjeta decia 2.
 *
 * Se cuentan en la base con `head: true`, que no trae filas: son tres consultas
 * de conteo sobre los mismos filtros que la lista.
 */
async function countBySeverity(
  admin: ReturnType<typeof createAdminSupabase>,
  organizationId: string | null,
  filtros: { startDate: string; search: string; userId: string | null },
  severity: AuditSeverity,
) {
  let query = applyBaseFilters(
    admin.from('audit_log').select('id', { count: 'exact', head: true }),
    { ...filtros, severity },
  )
  if (organizationId) query = query.eq('organization_id', organizationId)

  const { count, error } = await query
  return error ? null : count ?? 0
}

/**
 * Los intentos fallidos no son una gravedad sino un conjunto de acciones, asi
 * que se cuentan por accion.
 */
async function countFailedAttempts(
  admin: ReturnType<typeof createAdminSupabase>,
  organizationId: string | null,
  filtros: { startDate: string; search: string; userId: string | null },
) {
  let query = applyBaseFilters(
    admin.from('audit_log').select('id', { count: 'exact', head: true }),
    { ...filtros, severity: null },
  ).in('action', FAILED_ATTEMPT_ACTIONS)
  if (organizationId) query = query.eq('organization_id', organizationId)

  const { count, error } = await query
  return error ? null : count ?? 0
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
    // La cadena de filtro se arma a mano, asi que el termino no puede traer
    // caracteres que rompan su gramatica. Antes se escapaban con barra
    // invertida `%`, `_` y la coma, y los parentesis —que en PostgREST agrupan
    // condiciones— pasaban tal cual.
    //
    // Se usa la variante que conserva el punto y el guion bajo: el helper
    // general los borra, y aca son parte del dato (IPs, acciones en snake_case,
    // rutas de API).
    const escaped = sanitizeFilterTerm(params.search)
    if (!escaped) return nextQuery

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

    // El modulo lo exigia solo la pantalla, envuelta en el control de plan. La
    // API no comprobaba nada, asi que una tienda sin el pedia este endpoint por
    // HTTP y recibia su registro completo: son datos propios, no una fuga entre
    // tiendas, pero es una funcion paga consumida sin tenerla.
    const { effectiveModules } = await getOrganizationPlanInfo(organizationId)
    if (!effectiveModules.includes('security')) {
      return NextResponse.json(
        {
          error: 'El registro de seguridad no está incluido en tu plan.',
          code: 'SECURITY_MODULE_DISABLED',
        },
        { status: 403 }
      )
    }
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

  // La organizacion se acota en SQL, antes de paginar. Habia ademas un modo
  // "sin columna de organizacion" que reintentaba con menos campos y un filtro
  // en JavaScript que volvia a comprobar la pertenencia: la columna existe desde
  // junio, asi que ninguno de los dos podia ejecutarse. Aparentaban una defensa
  // que no estaba haciendo nada, y el filtro en JavaScript ademas habria hecho
  // que el conteo de paginas no coincidiera con lo devuelto.
  const scopedQuery = () => {
    let query = applyBaseFilters(
      admin.from('audit_log').select(SELECT_COLUMNS_WITH_ORG, { count: 'exact' }),
      { startDate, severity, search, userId }
    )
    if (organizationId) query = query.eq('organization_id', organizationId)
    return query
  }

  const response = await scopedQuery().order('created_at', { ascending: false }).range(from, to)

  if (response.error) {
    return NextResponse.json({ error: response.error.message || 'No se pudieron cargar los eventos de seguridad.' }, { status: 500 })
  }

  const scopedRows = (response.data || []) as AuditLogRow[]
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

  // Los tres conteos van sobre el rango completo, no sobre la pagina. Si alguno
  // falla se devuelve null en vez de un cero: un cero afirmaria que no hay
  // eventos criticos, que es exactamente lo contrario de lo que se sabe.
  const filtrosDeConteo = { startDate, search, userId }
  const [criticalEvents, highRiskEvents, failedAttempts] = await Promise.all([
    countBySeverity(admin, organizationId, filtrosDeConteo, 'critical'),
    countBySeverity(admin, organizationId, filtrosDeConteo, 'high'),
    countFailedAttempts(admin, organizationId, filtrosDeConteo),
  ])

  const stats = { totalEvents: totalCount, criticalEvents, highRiskEvents, failedAttempts }

  return NextResponse.json({
    logs,
    stats,
    totalCount,
    page,
    pageSize,
    users,
    // Solo importa al exportar: dice si quedaron eventos fuera del archivo.
    truncated: isExport && totalCount > logs.length,
  })
}

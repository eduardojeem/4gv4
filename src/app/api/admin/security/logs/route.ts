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
  create: { event: 'Creación de registro', severity: 'low' },
  update: { event: 'Actualización de registro', severity: 'low' },
  delete: { event: 'Eliminación de registro', severity: 'medium' },
  login: { event: 'Inicio de sesión exitoso', severity: 'low' },
  login_failed: { event: 'Intento de acceso fallido', severity: 'medium' },
  logout: { event: 'Cierre de sesión', severity: 'low' },
  password_change: { event: 'Cambio de contraseña', severity: 'low' },
  role_change: { event: 'Cambio de rol de usuario', severity: 'high' },
  grant_admin_self_rpc: { event: 'Auto-promoción a administrador', severity: 'critical' },
  grant_admin_migration: { event: 'Promoción a administrador', severity: 'high' },
  permission_denied: { event: 'Acceso denegado', severity: 'medium' },
  suspicious_activity: { event: 'Actividad sospechosa detectada', severity: 'high' },
  data_export: { event: 'Exportación de datos', severity: 'medium' },
  bulk_operation: { event: 'Operación masiva', severity: 'medium' },
  update_user_status: { event: 'Cambio de estado de usuario', severity: 'high' },
}

function timeRangeToDate(value: string | null) {
  const now = Date.now()
  const hours = value === '1h' ? 1 : value === '7d' ? 168 : value === '30d' ? 720 : 24
  return new Date(now - hours * 60 * 60 * 1000).toISOString()
}

function normalizeSeverity(value: unknown, fallback: Severity): Severity {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'critical' ? value : fallback
}

function stringifyDetails(value: unknown) {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  const keys = ['path', 'method', 'status', 'reason', 'organization_id']
  const pairs = keys
    .filter((key) => record[key] !== undefined && record[key] !== null)
    .map((key) => `${key}: ${String(record[key])}`)

  return pairs.length > 0 ? pairs.join(' · ') : undefined
}

function buildDetails(row: AuditLogRow) {
  const detail = stringifyDetails(row.details) || stringifyDetails(row.new_values)
  const resource = row.resource || 'sistema'
  const suffix = row.resource_id ? ` (${row.resource_id})` : ''

  return detail ? `${resource}${suffix} · ${detail}` : `${resource}${suffix}`
}

function computeStats(logs: SecurityLog[]) {
  const uniqueUsers = new Set<string>()
  const uniqueIPs = new Set<string>()

  for (const log of logs) {
    if (log.user && log.user !== 'Sistema') uniqueUsers.add(log.user)
    if (log.ip && log.ip !== 'N/A') uniqueIPs.add(log.ip)
  }

  return {
    totalEvents: logs.length,
    criticalEvents: logs.filter((log) => log.severity === 'critical').length,
    highRiskEvents: logs.filter((log) => log.severity === 'high').length,
    failedAttempts: logs.filter((log) => log.action?.includes('failed') || log.action === 'permission_denied').length,
    uniqueUsers: uniqueUsers.size,
    uniqueIPs: uniqueIPs.size,
  }
}

function organizationFromPayload(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  return typeof record.organization_id === 'string' ? record.organization_id : null
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
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 200), 25), 500)
  const startDate = timeRangeToDate(timeRange)
  const admin = createAdminSupabase()

  let organizationUserIds: Set<string> | null = null

  if (organizationId) {
    const { data: members, error: membersError } = await admin
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', organizationId)

    if (membersError) {
      return NextResponse.json({ error: 'No se pudieron cargar los miembros de la organización.' }, { status: 500 })
    }

    organizationUserIds = new Set((members || []).map((member) => member.user_id).filter(Boolean))
  }

  let query = admin
    .from('audit_log')
    .select('id, user_id, action, resource, resource_id, details, new_values, ip_address, user_agent, created_at, severity')
    .gte('created_at', startDate)
    .order('created_at', { ascending: false })
    .limit(limit)

  // Scope to org members at DB level so the limit doesn't cut out org-specific logs
  if (organizationId && organizationUserIds && organizationUserIds.size > 0) {
    query = query.in('user_id', Array.from(organizationUserIds))
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message || 'No se pudieron cargar los eventos de seguridad.' }, { status: 500 })
  }

  const scopedRows = ((data || []) as AuditLogRow[]).filter((row) => {
    if (!organizationUserIds || !organizationId) return true
    const payloadOrg = organizationFromPayload(row.new_values) || organizationFromPayload(row.details)
    return Boolean(row.user_id && organizationUserIds.has(row.user_id)) || payloadOrg === organizationId
  })

  const userIds = Array.from(new Set(scopedRows.map((row) => row.user_id).filter(Boolean))) as string[]
  const profilesById = new Map<string, string>()

  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds)

    for (const profile of profiles || []) {
      const name = profile.full_name || ''
      const email = profile.email || ''
      profilesById.set(profile.id, name && email ? `${name} (${email})` : name || email || 'Usuario desconocido')
    }
  }

  const logs = scopedRows.map((row): SecurityLog => {
    const mapped = EVENT_MAP[row.action] || { event: `Acción: ${row.action}`, severity: 'low' as Severity }
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
  })

  const filteredLogs = severity && severity !== 'all'
    ? logs.filter((log) => log.severity === severity)
    : logs

  return NextResponse.json({
    logs: filteredLogs,
    stats: computeStats(logs),
  })
}

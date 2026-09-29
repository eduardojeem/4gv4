import { createAdminSupabase } from '@/lib/supabase/admin'
import { isOrganizationId, organizationAuditFilter } from '@/lib/superadmin/organization-audit'

/**
 * Auditoría unificada de /superadmin/audit-logs.
 *
 * Fuentes (tablas reales, cada una con su esquema):
 *  - platform: audit_log (acciones de usuarios y del SuperAdmin)
 *  - tenants:  tenant_audit_log (acciones dentro de cada tienda)
 *  - finance:  finance_audit_events (movimientos financieros)
 *  - settings: system_settings_audit (cambios de configuración)
 * settings_change_history duplica system_settings_audit y no se muestra.
 *
 * Filtros, búsqueda y paginación se resuelven en la base, así la búsqueda y la
 * exportación cubren todos los resultados y no solo la página visible.
 */
export const AUDIT_SOURCES = ['platform', 'tenants', 'finance', 'settings'] as const
export type AuditSource = (typeof AUDIT_SOURCES)[number]

export const AUDIT_SEVERITIES = ['info', 'low', 'medium', 'high', 'critical'] as const
export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number]

export const AUDIT_PERIODS = { '24h': 1, '7d': 7, '30d': 30, '90d': 90, '365d': 365 } as const
export type AuditPeriod = keyof typeof AUDIT_PERIODS

/** Registro automático de cada llamada a /api/admin: tapa el resto si se muestra. */
export const NOISE_ACTIONS = ['admin_api_access']

export interface AuditFilters {
  source: AuditSource
  period: AuditPeriod
  severity: AuditSeverity | null
  organizationId: string | null
  query: string
  includeNoise: boolean
  page: number
}

export interface AuditEntry {
  id: string
  source: AuditSource
  createdAt: string
  actorId: string | null
  actorEmail: string | null
  action: string
  target: string | null
  organizationId: string | null
  organizationName: string | null
  severity: AuditSeverity | null
  ipAddress: string | null
}

export interface AuditPage {
  entries: AuditEntry[]
  total: number
  pageSize: number
  error: string | null
}

export const AUDIT_PAGE_SIZE = 25

type Config = {
  table: string
  dateColumn: string
  actorColumn: string
  actionColumn: string
  targetColumns: string[]
  orgColumn: string | null
  severityColumn: string | null
  ipColumn: string | null
  emailColumn: string | null
  detailColumns: string
}

const SOURCE_CONFIG: Record<AuditSource, Config> = {
  platform: { table: 'audit_log', dateColumn: 'created_at', actorColumn: 'user_id', actionColumn: 'action', targetColumns: ['resource', 'resource_id'], orgColumn: 'organization_id', severityColumn: 'severity', ipColumn: 'ip_address', emailColumn: null, detailColumns: 'details, new_values, old_values, user_agent' },
  tenants: { table: 'tenant_audit_log', dateColumn: 'created_at', actorColumn: 'user_id', actionColumn: 'action', targetColumns: ['resource', 'resource_id'], orgColumn: 'organization_id', severityColumn: null, ipColumn: 'ip_address', emailColumn: null, detailColumns: 'metadata, user_agent' },
  finance: { table: 'finance_audit_events', dateColumn: 'occurred_at', actorColumn: 'actor_id', actionColumn: 'action', targetColumns: ['entity_type', 'entity_id'], orgColumn: 'organization_id', severityColumn: null, ipColumn: null, emailColumn: null, detailColumns: 'old_values, new_values, branch_id' },
  settings: { table: 'system_settings_audit', dateColumn: 'created_at', actorColumn: 'user_id', actionColumn: 'action', targetColumns: ['field_name'], orgColumn: null, severityColumn: 'severity', ipColumn: 'ip_address', emailColumn: 'user_email', detailColumns: 'old_value, new_value, details, user_agent' },
}

export function sourceSupports(source: AuditSource) {
  const c = SOURCE_CONFIG[source]
  return { severity: Boolean(c.severityColumn), organization: Boolean(c.orgColumn), noise: source === 'platform' }
}

/** Severidades guardadas con otros nombres a lo largo del tiempo. */
export function normalizeSeverity(value: unknown): AuditSeverity | null {
  if (typeof value !== 'string') return null
  if ((AUDIT_SEVERITIES as readonly string[]).includes(value)) return value as AuditSeverity
  if (value === 'warning') return 'medium'
  if (value === 'error') return 'high'
  return null
}

export function parseAuditFilters(params: Record<string, string | undefined>): AuditFilters {
  const source = (AUDIT_SOURCES as readonly string[]).includes(params.source ?? '') ? (params.source as AuditSource) : 'platform'
  const period = (params.period ?? '') in AUDIT_PERIODS ? (params.period as AuditPeriod) : '7d'
  const severity = (AUDIT_SEVERITIES as readonly string[]).includes(params.severity ?? '') ? (params.severity as AuditSeverity) : null
  return {
    source,
    period,
    severity: sourceSupports(source).severity ? severity : null,
    organizationId: sourceSupports(source).organization && isOrganizationId(params.org) ? params.org! : null,
    // Sin caracteres que alteren la sintaxis de filtros de PostgREST.
    query: (params.q ?? '').replace(/[,()*\\%]/g, ' ').trim().slice(0, 80),
    includeNoise: params.noise === '1',
    page: Math.max(0, Math.min(10_000, Number.parseInt(params.page ?? '0', 10) || 0)),
  }
}

type Row = Record<string, unknown>

async function resolveUserIdsByEmail(query: string): Promise<string[]> {
  if (!query.includes('@') && query.length < 3) return []
  const admin = createAdminSupabase()
  const { data } = await admin.from('profiles').select('id').ilike('email', `%${query}%`).limit(50)
  return ((data ?? []) as Array<{ id: string }>).map((p) => p.id)
}

function buildQuery(filters: AuditFilters, columns: string, userIds: string[]) {
  const c = SOURCE_CONFIG[filters.source]
  const admin = createAdminSupabase()
  const since = new Date(Date.now() - AUDIT_PERIODS[filters.period] * 86_400_000).toISOString()
  let query = admin.from(c.table).select(columns, { count: 'exact' }).gte(c.dateColumn, since).order(c.dateColumn, { ascending: false })

  if (filters.severity && c.severityColumn) {
    // Los registros viejos sin severidad se tratan como informativos.
    query = filters.severity === 'info'
      ? query.or(`${c.severityColumn}.eq.info,${c.severityColumn}.is.null`)
      : query.eq(c.severityColumn, filters.severity)
  }
  if (filters.organizationId && c.orgColumn) {
    query = filters.source === 'platform'
      ? query.or(organizationAuditFilter(filters.organizationId))
      : query.eq(c.orgColumn, filters.organizationId)
  }
  if (filters.source === 'platform' && !filters.includeNoise) {
    query = query.not('action', 'in', `(${NOISE_ACTIONS.join(',')})`)
  }
  if (filters.query) {
    const like = `%${filters.query}%`
    const parts = [`${c.actionColumn}.ilike.${like}`, ...c.targetColumns.map((col) => `${col}.ilike.${like}`)]
    if (c.emailColumn) parts.push(`${c.emailColumn}.ilike.${like}`)
    if (userIds.length) parts.push(`${c.actorColumn}.in.(${userIds.join(',')})`)
    query = query.or(parts.join(','))
  }
  return query
}

function listColumns(source: AuditSource): string {
  const c = SOURCE_CONFIG[source]
  return [
    'id', c.dateColumn, c.actorColumn, c.actionColumn, ...c.targetColumns,
    c.orgColumn, c.severityColumn, c.ipColumn, c.emailColumn,
  ].filter(Boolean).join(', ')
}

async function hydrate(source: AuditSource, rows: Row[]): Promise<AuditEntry[]> {
  const c = SOURCE_CONFIG[source]
  const admin = createAdminSupabase()
  const actorIds = [...new Set(rows.map((r) => r[c.actorColumn]).filter((v): v is string => typeof v === 'string'))]
  const orgIds = [...new Set(rows.flatMap((r) => {
    const ids: string[] = []
    if (c.orgColumn && typeof r[c.orgColumn] === 'string') ids.push(r[c.orgColumn] as string)
    if (source === 'platform' && r.resource === 'organizations' && typeof r.resource_id === 'string' && isOrganizationId(r.resource_id)) ids.push(r.resource_id)
    return ids
  }))]
  const [profiles, orgs] = await Promise.all([
    actorIds.length ? admin.from('profiles').select('id, email').in('id', actorIds) : Promise.resolve({ data: [] }),
    orgIds.length ? admin.from('organizations').select('id, name').in('id', orgIds) : Promise.resolve({ data: [] }),
  ])
  const emails = new Map(((profiles.data ?? []) as Array<{ id: string; email: string | null }>).map((p) => [p.id, p.email]))
  const orgNames = new Map(((orgs.data ?? []) as Array<{ id: string; name: string }>).map((o) => [o.id, o.name]))

  return rows.map((r) => {
    const actorId = typeof r[c.actorColumn] === 'string' ? (r[c.actorColumn] as string) : null
    const orgId = (c.orgColumn && typeof r[c.orgColumn] === 'string' ? (r[c.orgColumn] as string) : null)
      ?? (source === 'platform' && r.resource === 'organizations' && typeof r.resource_id === 'string' ? r.resource_id : null)
    const target = c.targetColumns.map((col) => r[col]).filter((v) => typeof v === 'string' && v).join(' · ') || null
    return {
      id: String(r.id),
      source,
      createdAt: String(r[c.dateColumn] ?? ''),
      actorId,
      actorEmail: (c.emailColumn ? (r[c.emailColumn] as string | null) : null) ?? (actorId ? emails.get(actorId) ?? null : null),
      action: String(r[c.actionColumn] ?? ''),
      target,
      organizationId: orgId,
      organizationName: orgId ? orgNames.get(orgId) ?? null : null,
      severity: c.severityColumn ? normalizeSeverity(r[c.severityColumn]) ?? 'info' : null,
      ipAddress: c.ipColumn ? (r[c.ipColumn] as string | null) ?? null : null,
    }
  })
}

export async function getAuditPage(filters: AuditFilters): Promise<AuditPage> {
  const userIds = filters.query ? await resolveUserIdsByEmail(filters.query) : []
  const from = filters.page * AUDIT_PAGE_SIZE
  const { data, count, error } = await buildQuery(filters, listColumns(filters.source), userIds).range(from, from + AUDIT_PAGE_SIZE - 1)
  if (error) return { entries: [], total: 0, pageSize: AUDIT_PAGE_SIZE, error: error.message }
  return { entries: await hydrate(filters.source, (data ?? []) as unknown as Row[]), total: count ?? 0, pageSize: AUDIT_PAGE_SIZE, error: null }
}

export const AUDIT_EXPORT_LIMIT = 5000

/** Mismos filtros que la pantalla, hasta AUDIT_EXPORT_LIMIT filas. */
export async function getAuditExport(filters: AuditFilters): Promise<{ entries: AuditEntry[]; truncated: boolean }> {
  const userIds = filters.query ? await resolveUserIdsByEmail(filters.query) : []
  const entries: AuditEntry[] = []
  let total = 0
  for (let from = 0; from < AUDIT_EXPORT_LIMIT; from += 1000) {
    const { data, count, error } = await buildQuery(filters, listColumns(filters.source), userIds).range(from, Math.min(from + 999, AUDIT_EXPORT_LIMIT - 1))
    if (error) throw new Error(error.message)
    total = count ?? total
    entries.push(...(await hydrate(filters.source, (data ?? []) as unknown as Row[])))
    if ((data ?? []).length < 1000) break
  }
  return { entries, truncated: total > entries.length }
}

export async function getAuditEntryDetail(source: AuditSource, id: string): Promise<Record<string, unknown> | null> {
  const c = SOURCE_CONFIG[source]
  const admin = createAdminSupabase()
  const { data, error } = await admin.from(c.table).select(c.detailColumns).eq('id', id).maybeSingle()
  if (error || !data) return null
  return data as unknown as Record<string, unknown>
}

export function toCsv(entries: AuditEntry[]): string {
  const header = ['fecha', 'fuente', 'usuario', 'accion', 'objetivo', 'tienda', 'severidad', 'ip']
  const escape = (value: unknown) => {
    const text = value == null ? '' : String(value)
    // Evita que Excel interprete celdas como fórmulas (CSV injection).
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
    return `"${safe.replace(/"/g, '""')}"`
  }
  const lines = entries.map((e) =>
    [e.createdAt, e.source, e.actorEmail ?? e.actorId ?? '', e.action, e.target ?? '', e.organizationName ?? e.organizationId ?? '', e.severity ?? '', e.ipAddress ?? '']
      .map(escape).join(','),
  )
  return [header.join(','), ...lines].join('\n')
}

import type { CatalogPolicy, CatalogTable, CatalogView } from '@/lib/health/catalog'
import { compareSeverity, worstSeverity, worstStatus } from '@/lib/health/core'
import type { HealthSeverity, HealthStatus, TenantTableFinding } from '@/lib/health/types'

/**
 * Análisis estático de aislamiento multi-tenant sobre el texto real de las
 * políticas (pg_policies). No ejecuta consultas contra los datos.
 *
 * Una política permissive se une con OR a las demás de la tabla: basta UNA
 * rama sin filtro por organización para que cualquier usuario que cumpla esa
 * rama vea filas de todas las organizaciones. Por eso se separa cada política
 * en sus ramas OR de primer nivel y se clasifica cada una.
 */

/** Tablas globales de la plataforma: no pertenecen a una organización. */
export const GLOBAL_TABLES = new Set([
  'organizations',
  'profiles',
  'user_roles',
  'plans',
  'subscription_plans',
  'subscription_promo_codes',
  'system_settings',
  'system_settings_audit',
  'global_brands',
  'global_categories',
  'global_notifications',
  'global_notification_reads',
  'database_growth_snapshots',
  'public_access_audit',
  'rate_limit_settings',
  'marketplace_user_preferences',
  'public_product_favorites',
  'user_security_settings',
  'user_sessions',
  'user_activity',
  'content',
  'posts',
  'social_links',
  'promotions_carousel',
  'email_logs',
  'settings_change_history',
  'system_health_checks',
  'payment_webhook_events',
  // Documentos legales de la plataforma: lo publicado es público a propósito.
  'legal_documents',
  // Directorio público de ruteo: el proxy lo lee con la anon key para
  // redirigir slugs viejos. La lectura pública es intencional.
  'organization_slug_aliases',
  // Atributos de variante compartidos por todas las tiendas (sin organization_id).
  'variant_attributes',
  'variant_attribute_options',
])

/**
 * Tablas de tenant cuya lectura pública filtrada por una condición es parte del
 * producto (no un descuido): p. ej. reseñas publicadas visibles en la tienda.
 * Solo exime SELECT con condición; cualquier otro hallazgo se sigue reportando.
 */
export const INTENTIONAL_PUBLIC_READ = new Set(['organization_reviews'])

/** Funciones que miran un rol global (JWT / user_roles) y NO la organización. */
const GLOBAL_ROLE_FN = /\b(is_admin|is_manager|is_staff|is_technician|is_admin_or_manager|is_vendedor|get_jwt_role|get_my_role|has_role|has_permission)\s*\(/i
/** Rol leído de tablas globales (user_roles, profiles.role) dentro de un EXISTS o subconsulta. */
const GLOBAL_ROLE_TABLE = /\buser_roles\b|\bprofiles\b[\s\S]*\brole\b/i
/** La rama está acotada a una organización o sucursal. */
const ORG_SCOPE_TOKENS =
  /organization_id|branch_id|has_org_[a-z_]*\s*\(|is_org_[a-z_]*\s*\(|get_org_role\s*\(|org_member|organization_members|user_has_branch|current_organization/i
/** La rama solo da acceso a filas propias del usuario. */
const OWNER_TOKENS = /auth\.uid\s*\(\)|auth\.jwt\s*\(\)|profile_id|user_id|owner_id|author_id|customer_id|created_by/i
const SUPERADMIN_ONLY = /is_super_?admin\s*\(|'super_?admin'::text/i
const BROAD_ROLE_FN = /\b(is_admin|is_manager|is_staff|is_technician|is_admin_or_manager|is_vendedor|has_role|has_permission)\s*\(/i
const OTHER_ROLE_LITERAL =/'(admin|manager|vendedor|seller|tecnico|technician|staff|cashier)'::text/i

export type BranchKind = 'scoped' | 'unfiltered' | 'global_role' | 'public_condition' | 'restricted'

/**
 * Forma compacta para comparar expresiones triviales sin depender de cómo
 * Postgres las reescribe: `(( SELECT ( SELECT auth.role() AS role) AS role) =
 * 'authenticated'::text)` queda `auth.role='authenticated'::text`.
 */
function compact(expression: string): string {
  return expression
    .toLowerCase()
    .replace(/"/g, '')
    .replace(/\bselect\b/g, '')
    .replace(/\bas\s+[a-z_]+/g, '')
    .replace(/[()\s]/g, '')
}

const TRIVIAL_COMPACT = /^(true|auth\.role='(authenticated|anon)'::text|auth\.uidisnotnull)$/
const SERVICE_ROLE_COMPACT = /^auth\.role='service_role'::text$/

function stripOuterParens(expression: string): string {
  let current = expression.trim()
  while (current.startsWith('(') && current.endsWith(')')) {
    let depth = 0
    let enclosesAll = true
    for (let i = 0; i < current.length; i += 1) {
      if (current[i] === '(') depth += 1
      else if (current[i] === ')') depth -= 1
      if (depth === 0 && i < current.length - 1) {
        enclosesAll = false
        break
      }
    }
    if (!enclosesAll) break
    current = current.slice(1, -1).trim()
  }
  return current
}

/** Separa por OR de primer nivel (fuera de paréntesis y de literales). */
export function splitTopLevelOr(expression: string): string[] {
  const source = stripOuterParens(expression)
  const branches: string[] = []
  let depth = 0
  let inQuote = false
  let start = 0
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    if (char === "'") {
      inQuote = !inQuote
      continue
    }
    if (inQuote) continue
    if (char === '(') depth += 1
    else if (char === ')') depth -= 1
    else if (depth === 0 && /^\sOR\s/i.test(source.slice(i, i + 4))) {
      branches.push(source.slice(start, i).trim())
      start = i + 3
      i += 2
    }
  }
  branches.push(source.slice(start).trim())
  return branches.filter(Boolean).map(stripOuterParens)
}

export function classifyBranch(branch: string): BranchKind {
  const normalized = branch.replace(/"/g, '').replace(/\s+/g, ' ').trim()
  const compactForm = compact(normalized)
  if (SERVICE_ROLE_COMPACT.test(compactForm)) return 'restricted'
  if (TRIVIAL_COMPACT.test(compactForm)) return 'unfiltered'
  if (ORG_SCOPE_TOKENS.test(normalized)) return 'scoped'
  const globalRole = GLOBAL_ROLE_FN.test(normalized) || GLOBAL_ROLE_TABLE.test(normalized)
  // `get_jwt_role() = 'super_admin'` es exclusivo de SuperAdmin; is_admin() o
  // has_permission() en cambio también aceptan admins de cualquier organización.
  if (SUPERADMIN_ONLY.test(normalized) && !OTHER_ROLE_LITERAL.test(normalized) && !BROAD_ROLE_FN.test(normalized)) {
    return 'restricted'
  }
  // Un rol global combinado con AND sobre el propio usuario (p. ej. is_manager()
  // AND changed_by = auth.uid()) sigue permitiendo escribir filas de otra organización.
  if (globalRole) return 'global_role'
  if (OWNER_TOKENS.test(normalized)) return 'scoped'
  return 'public_condition'
}

export function classifyExpression(expression: string | null): BranchKind[] {
  if (!expression || !expression.trim()) return ['unfiltered']
  return splitTopLevelOr(expression).map(classifyBranch)
}

function appliesToClients(policy: CatalogPolicy): boolean {
  return policy.roles.some((role) => role === 'public' || role === 'anon' || role === 'authenticated')
}

function includesAnon(policy: CatalogPolicy): boolean {
  return policy.roles.some((role) => role === 'public' || role === 'anon')
}

function coversCommand(policy: CatalogPolicy, command: CatalogPolicy['command']): boolean {
  return policy.command === 'ALL' || policy.command === command
}

type Issue = { status: HealthStatus; severity: HealthSeverity; reason: string }

const BRANCH_LABEL: Record<Exclude<BranchKind, 'scoped' | 'restricted'>, string> = {
  unfiltered: 'sin ningún filtro',
  global_role: 'filtrada solo por rol global (is_admin/is_manager/...), no por organización',
  public_condition: 'filtrada por una condición que no es la organización',
}

function policyIssues(table: CatalogTable, tenant: boolean): Issue[] {
  // CRITICAL solo con evidencia directa (la tabla tiene organization_id). Sin
  // esa columna no se puede saber desde el esquema si las filas son de un tenant.
  const leakSeverity: HealthSeverity = table.has_organization_id ? 'critical' : 'high'
  const leakSuffix = table.has_organization_id
    ? ''
    : ' (la tabla no tiene organization_id: si sus filas pertenecen a una organización, el riesgo es crítico)'
  const issues: Issue[] = []
  const restrictiveScoped = table.policies.filter(
    (policy) => !policy.permissive && appliesToClients(policy) &&
      classifyExpression(policy.using ?? policy.with_check).every((kind) => kind === 'scoped'),
  )

  for (const policy of table.policies) {
    if (!policy.permissive || !appliesToClients(policy)) continue
    const expression = policy.command === 'INSERT' ? policy.with_check : policy.using
    const kinds = classifyExpression(expression)
    const weakest = kinds.find((kind) => kind === 'unfiltered')
      ?? kinds.find((kind) => kind === 'global_role')
      ?? kinds.find((kind) => kind === 'public_condition')
    if (!weakest) continue

    const guarded = restrictiveScoped.some((restrictive) =>
      restrictive.command === 'ALL' || restrictive.command === policy.command,
    )
    const isRead = coversCommand(policy, 'SELECT')
    const label = `Política "${policy.name}" (${policy.command}) ${BRANCH_LABEL[weakest]}`

    if (guarded) {
      issues.push({ status: 'warning', severity: 'low', reason: `${label}; una política RESTRICTIVE por organización la acota.` })
      continue
    }

    if (tenant) {
      if (weakest === 'public_condition' && policy.command === 'SELECT') {
        if (INTENTIONAL_PUBLIC_READ.has(table.name)) continue
        issues.push({
          status: 'warning',
          severity: includesAnon(policy) ? 'medium' : 'high',
          reason: `${label}: cualquier ${includesAnon(policy) ? 'visitante' : 'usuario autenticado'} lee filas de todas las organizaciones que cumplan la condición. Confirmar que es contenido público intencional.`,
        })
      } else {
        issues.push({
          status: 'error',
          severity: leakSeverity,
          reason: `${label}: posible ${isRead ? 'lectura' : 'escritura'} entre organizaciones${leakSuffix}.`,
        })
      }
    } else if (policy.command !== 'SELECT') {
      issues.push(
        weakest === 'global_role'
          ? { status: 'warning', severity: 'medium', reason: `${label} en una tabla global: cualquier admin de cualquier organización puede modificarla, no solo SuperAdmin.` }
          : { status: 'warning', severity: 'high', reason: `${label} en una tabla global: permite escritura a ${includesAnon(policy) ? 'visitantes' : 'cualquier usuario autenticado'}.` },
      )
    }
  }
  return issues
}

export function analyzeTable(table: CatalogTable): TenantTableFinding {
  // La lista explícita manda: una tabla global o de lectura pública intencional puede
  // tener organization_id (p. ej. organization_slug_aliases) sin ser dato privado.
  const tenant = !GLOBAL_TABLES.has(table.name)
  const exposed = table.anon_select || table.authenticated_select
  const issues: Issue[] = []

  if (!table.rls_enabled) {
    if (exposed) {
      issues.push({
        status: 'error',
        severity: tenant ? 'critical' : 'high',
        reason: `RLS desactivado y ${table.anon_select ? 'anon' : 'authenticated'} tiene SELECT: la tabla completa es legible desde el navegador.`,
      })
    } else {
      issues.push({ status: 'warning', severity: 'low', reason: 'RLS desactivado; hoy sin grants para anon/authenticated (solo service_role).' })
    }
  } else if (table.policies.length === 0) {
    // RLS sin políticas = denegado para clientes. Correcto para tablas internas.
  } else {
    issues.push(...policyIssues(table, tenant))
  }

  const clientPolicies = table.policies.filter(appliesToClients)
  if (tenant && !table.has_organization_id && table.rls_enabled && clientPolicies.length > 0) {
    const anyScoped = clientPolicies.some((policy) =>
      classifyExpression(policy.using ?? policy.with_check).some((kind) => kind === 'scoped'),
    )
    if (!anyScoped) {
      issues.push({
        status: 'warning',
        severity: 'medium',
        reason: 'No tiene organization_id y ninguna política la vincula a una organización (ni por tabla padre). Debería tener organization_id o una política vía EXISTS sobre la tabla padre.',
      })
    }
  }

  if (issues.length === 0) {
    const reason = !table.rls_enabled
      ? 'RLS desactivado'
      : table.policies.length === 0
        ? 'RLS activo sin políticas: solo service_role accede.'
        : tenant
          ? 'RLS activo; todas las políticas filtran por organización, usuario o condición acotada.'
          : 'Tabla global con RLS activo.'
    return { table: table.name, status: 'healthy', severity: 'info', reasons: [reason] }
  }

  issues.sort((a, b) => compareSeverity(a.severity, b.severity))
  return {
    table: table.name,
    status: worstStatus(issues.map((issue) => issue.status)),
    severity: worstSeverity(issues.map((issue) => issue.severity)),
    reasons: issues.map((issue) => issue.reason),
  }
}

export function analyzeViews(views: CatalogView[]): Array<{ view: string; severity: HealthSeverity; reason: string }> {
  return views
    .filter((view) => !view.security_invoker && (view.anon_select || view.authenticated_select))
    .map((view) => ({
      view: view.name,
      severity: view.has_organization_id ? 'high' : 'low',
      reason: `${view.kind === 'materialized' ? 'Vista materializada' : 'Vista'} sin security_invoker con SELECT para ${view.anon_select ? 'anon' : 'authenticated'}: se ejecuta con permisos del dueño y omite el RLS de las tablas base.`,
    }))
}

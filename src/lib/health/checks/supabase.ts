import type { SupabaseClient } from '@supabase/supabase-js'
import { errorMessage, runCheck } from '@/lib/health/core'
import { fetchAllRows } from '@/lib/superadmin/fetch-all-rows'
import { HEALTH_MIGRATION, type CatalogResult, type HealthCatalog } from '@/lib/health/catalog'
import { analyzeTable, analyzeViews } from '@/lib/health/tenant-isolation'
import { auditPublicBuckets } from '@/lib/health/public-bucket-audit'
import { codeAudit } from '@/lib/health/code-audit'
import { evaluateMigrationHealth } from '@/lib/health/migration-drift'
import type {
  HealthCheckResult,
  HealthMetricGroup,
  TenantTableFinding,
} from '@/lib/health/types'

type Admin = SupabaseClient

async function count(admin: Admin, table: string): Promise<number> {
  const { count: value, error } = await admin.from(table).select('*', { count: 'exact', head: true })
  if (error) throw error
  return value ?? 0
}

async function allRows<T>(admin: Admin, table: string, columns: string): Promise<{ rows: T[]; error: string | null }> {
  try {
    const rows = await fetchAllRows<T>((from, to) =>
      admin.from(table).select(columns).range(from, to) as unknown as PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
    )
    return { rows, error: null }
  } catch (error) {
    return { rows: [], error: errorMessage(error) }
  }
}

export async function runSupabaseChecks(admin: Admin, catalog: CatalogResult): Promise<{
  checks: HealthCheckResult[]
  metrics: HealthMetricGroup[]
  tenantTables: TenantTableFinding[]
}> {
  const catalogMethod = 'RPC get_system_health_catalog() (pg_class, pg_policies, storage.buckets, auth.users; solo agregados).'
  const catalogUnavailable = 'reason' in catalog ? catalog.reason : null

  const checks = await Promise.all([
    runCheck(
      {
        id: 'supabase.database',
        category: 'supabase',
        name: 'Base de datos',
        description: 'Conectividad real con Postgres a través de PostgREST usando la service role (server-side).',
        method: 'SELECT count(*) HEAD sobre organizations; se mide la latencia.',
      },
      async () => {
        const start = Date.now()
        const { error } = await admin.from('organizations').select('id', { count: 'exact', head: true })
        const latency = Date.now() - start
        if (error) {
          return { status: 'error', severity: 'critical', summary: `La base de datos no respondió: ${errorMessage(error)}` }
        }
        return {
          status: latency > 1500 ? 'warning' : 'healthy',
          severity: 'medium',
          summary: `Responde en ${latency} ms`,
          findings: latency > 1500 ? [`Latencia alta (${latency} ms) para una consulta trivial.`] : [],
          metadata: { latencyMs: latency },
        }
      },
    ),
    runCheck(
      {
        id: 'supabase.auth',
        category: 'auth',
        name: 'Supabase Auth',
        description: 'Conectividad con el servicio de autenticación (GoTrue).',
        method: 'auth.admin.listUsers({ perPage: 1 }) desde el servidor. No se envían datos de usuarios al navegador.',
      },
      async () => {
        const start = Date.now()
        const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
        const latency = Date.now() - start
        if (error) return { status: 'error', severity: 'high', summary: `Auth no respondió: ${errorMessage(error)}` }
        return { status: 'healthy', severity: 'info', summary: `Responde en ${latency} ms`, metadata: { latencyMs: latency } }
      },
    ),
    runCheck(
      {
        id: 'supabase.storage',
        category: 'storage',
        name: 'Supabase Storage',
        description: 'Conectividad con Storage y visibilidad de los buckets.',
        method: 'storage.listBuckets() desde el servidor.',
      },
      async () => {
        const { data, error } = await admin.storage.listBuckets()
        if (error) return { status: 'error', severity: 'high', summary: `Storage no respondió: ${errorMessage(error)}` }
        return { status: 'healthy', severity: 'info', summary: `${data.length} buckets accesibles` }
      },
    ),
    runCheck(
      {
        id: 'storage.public_buckets',
        category: 'storage',
        name: 'Buckets públicos',
        description: 'Un bucket público sirve cualquier archivo por URL sin autenticación. Aceptable para imágenes de catálogo; no para documentos.',
        method: 'storage.listBuckets() y muestreo paginado/acotado de hasta 200 objetos públicos; solo se reportan conteos y familias MIME, nunca nombres.',
      },
      async () => {
        const { data, error } = await admin.storage.listBuckets()
        if (error) return { status: 'unknown', severity: 'medium', summary: `No se pudo listar buckets: ${errorMessage(error)}` }
        return auditPublicBuckets(admin, data)
      },
    ),
  ])

  const metrics: HealthMetricGroup[] = []
  let tenantTables: TenantTableFinding[] = []

  if (!catalog.available) {
    const pending = {
      status: 'unknown' as const,
      severity: 'high' as const,
      summary: 'No disponible: falta el catálogo de seguridad.',
      findings: [catalogUnavailable ?? ''],
      recommendation: `Aplicar ${HEALTH_MIGRATION} en Supabase (SQL Editor o supabase db push).`,
    }
    checks.push(
      await runCheck({ id: 'tenancy.rls', category: 'tenancy', name: 'RLS en tablas', description: 'Estado de Row Level Security de cada tabla pública.', method: catalogMethod }, async () => pending),
      await runCheck({ id: 'tenancy.policies', category: 'tenancy', name: 'Aislamiento entre organizaciones', description: 'Políticas que podrían permitir acceso cruzado entre organizaciones.', method: catalogMethod }, async () => pending),
    )
  } else {
    const { catalog: data } = catalog
    tenantTables = data.tables.map(analyzeTable).sort((a, b) => a.table.localeCompare(b.table))
    const viewFindings = analyzeViews(data.views)

    checks.push(
      await runCheck(
        {
          id: 'tenancy.rls',
          category: 'tenancy',
          name: 'RLS en tablas',
          description: 'Toda tabla pública debería tener RLS activo; sin RLS, los grants de anon/authenticated exponen la tabla completa.',
          method: catalogMethod,
        },
        async () => {
          const disabled = data.tables.filter((t) => !t.rls_enabled)
          const exposed = disabled.filter((t) => t.anon_select || t.authenticated_select)
          return {
            status: exposed.length > 0 ? 'error' : disabled.length > 0 ? 'warning' : 'healthy',
            severity: exposed.some((t) => t.has_organization_id) ? 'critical' : exposed.length > 0 ? 'high' : 'low',
            summary: disabled.length === 0
              ? `RLS activo en las ${data.tables.length} tablas`
              : `${disabled.length} tabla(s) sin RLS${exposed.length ? `, ${exposed.length} expuesta(s) a clientes` : ''}`,
            findings: disabled.map((t) => `${t.name}: RLS desactivado${t.anon_select || t.authenticated_select ? ' y con SELECT para clientes' : ' (sin grants a clientes)'}`),
            recommendation: disabled.length > 0
              ? 'ALTER TABLE ... ENABLE ROW LEVEL SECURITY y crear políticas por organization_id. Revisar primero qué consultas dependen de la tabla.'
              : undefined,
            metadata: { tables: data.tables.length, withoutRls: disabled.length },
          }
        },
      ),
      await runCheck(
        {
          id: 'tenancy.policies',
          category: 'tenancy',
          name: 'Aislamiento entre organizaciones',
          description: 'Detecta políticas permissive sin filtro por organización (se unen con OR, basta una), incluidas las que solo miran un rol global como is_admin() o is_manager().',
          method: `${catalogMethod} Análisis del texto de cada política; no se consultan datos de clientes.`,
        },
        async () => {
          const critical = tenantTables.filter((t) => t.severity === 'critical')
          const realWarnings = tenantTables.filter((t) => t.status === 'warning' && t.severity !== 'low')
          const guardedOnly = tenantTables.filter((t) => t.status === 'warning' && t.severity === 'low')
          const hasIssues = critical.length > 0 || realWarnings.length > 0
          return {
            status: critical.length > 0 ? 'error' : realWarnings.length > 0 ? 'warning' : 'healthy',
            severity: critical.length > 0 ? 'critical' : realWarnings.some((t) => t.severity === 'high') ? 'high' : realWarnings.length > 0 ? 'medium' : 'info',
            summary: critical.length > 0
              ? `${critical.length} tabla(s) con posible acceso entre organizaciones`
              : realWarnings.length > 0
                ? `${realWarnings.length} tabla(s) para revisar`
                : guardedOnly.length > 0
                  ? `Todas las políticas están acotadas (${guardedOnly.length} tabla(s) blindadas con política RESTRICTIVE)`
                  : 'Todas las políticas filtran por organización o usuario',
            findings: [...critical, ...realWarnings, ...guardedOnly].slice(0, 40).map((t) => `${t.table}: ${t.reasons[0]}`),
            recommendation: hasIssues
              ? 'Reemplazar ramas como is_admin()/is_manager()/auth.role() = \'authenticated\' por has_org_permission(organization_id, ...) o EXISTS sobre la tabla padre. ' +
                'Ver supabase/migrations/20260927140000_close_cross_tenant_read_leak.sql como precedente. Verificar cada caso en staging antes de cambiar políticas.'
              : undefined,
            metadata: { critical: critical.length, warnings: realWarnings.length, guarded: guardedOnly.length },
          }
        },
      ),
      await runCheck(
        {
          id: 'tenancy.org_column',
          category: 'tenancy',
          name: 'Tablas sin organization_id',
          description: 'Tablas de negocio que no tienen organization_id dependen de una tabla padre para aislarse.',
          method: catalogMethod,
        },
        async () => {
          const orphan = tenantTables.filter((t) => t.reasons.some((r) => r.startsWith('No tiene organization_id')))
          return {
            status: orphan.length > 0 ? 'warning' : 'healthy',
            severity: 'medium',
            summary: orphan.length > 0 ? `${orphan.length} tabla(s) sin organization_id ni política vinculada` : 'Sin tablas de negocio desvinculadas',
            findings: orphan.map((t) => t.table),
            recommendation: 'Agregar organization_id (con backfill desde la tabla padre) o una política con EXISTS sobre la tabla padre filtrada por organización.',
          }
        },
      ),
      await runCheck(
        {
          id: 'tenancy.views',
          category: 'tenancy',
          name: 'Vistas que omiten RLS',
          description: 'Una vista sin security_invoker corre con permisos de su dueño (postgres) e ignora el RLS de las tablas base.',
          method: catalogMethod,
        },
        async () => {
          const high = viewFindings.filter((v) => v.severity === 'high')
          return {
            status: high.length > 0 ? 'error' : viewFindings.length > 0 ? 'warning' : 'healthy',
            severity: high.length > 0 ? 'high' : 'low',
            summary: viewFindings.length === 0
              ? `${data.views.length} vistas revisadas; ninguna expuesta sin security_invoker`
              : `${viewFindings.length} vista(s) expuesta(s) sin security_invoker (${high.length} con organization_id)`,
            findings: viewFindings.map((v) => `${v.view}: ${v.reason}`),
            recommendation: 'ALTER VIEW ... SET (security_invoker = true) o revocar SELECT a anon/authenticated y servirla solo desde el servidor.',
          }
        },
      ),
      await runCheck(
        {
          id: 'tenancy.anon_definer_functions',
          category: 'tenancy',
          name: 'Funciones SECURITY DEFINER ejecutables por anon',
          description: 'Estas funciones omiten RLS y un visitante sin sesión puede llamarlas por /rest/v1/rpc. Cada una debe validar sus parámetros y su alcance.',
          method: catalogMethod,
        },
        async () => {
          const fns = data.anon_security_definer_functions
          return {
            status: fns.length > 0 ? 'warning' : 'healthy',
            severity: 'medium',
            summary: fns.length > 0 ? `${fns.length} función(es) para revisar` : 'Ninguna',
            findings: fns.slice(0, 60),
            recommendation: 'REVOKE EXECUTE ... FROM anon, public en las que no sean para visitantes; en las públicas, validar organización y limitar resultados.',
          }
        },
      ),
      await runCheck(
        {
          id: 'supabase.migrations',
          category: 'supabase',
          name: 'Migraciones registradas',
          description: 'Historial de migraciones de la CLI de Supabase (supabase_migrations.schema_migrations).',
          method: catalogMethod,
        },
        async () => {
          if (!data.migrations) {
            return { status: 'not_configured', severity: 'low', summary: 'No hay historial de migraciones de la CLI en esta base.' }
          }
          if (!data.migrations.versions) {
            return {
              status: 'unknown',
              severity: 'medium',
              summary: `${data.migrations.count} migraciones registradas; no se pudo comparar el historial completo`,
              recommendation: 'Aplicar la migración que crea get_system_health_migration_versions() y volver a ejecutar el diagnóstico.',
            }
          }
          const drift = evaluateMigrationHealth(codeAudit.migrationVersions, data.migrations.versions)
          const findings = [
            ...drift.missingRemote.map((version) => `${version}: existe en el repositorio pero no en el historial remoto`),
            ...drift.remoteOnly.map((version) => `${version}: existe en el historial remoto pero no en este checkout`),
          ]
          return {
            status: drift.status,
            severity: drift.status === 'warning' ? 'medium' : 'info',
            summary: drift.status === 'healthy'
              ? `${data.migrations.count} migraciones sincronizadas; última ${data.migrations.latest ?? '—'}`
              : `${findings.length} diferencia(s) entre repositorio e historial remoto`,
            findings,
            recommendation: drift.status === 'warning'
              ? 'Revisar supabase migration list y aplicar o reparar el historial antes del próximo despliegue.'
              : undefined,
          }
        },
      ),
    )

    // Storage (métricas y archivos por bucket)
    const buckets = data.storage_buckets
    metrics.push({
      id: 'storage',
      title: 'Storage',
      metrics: [
        { label: 'Buckets', value: buckets.length },
        { label: 'Públicos', value: buckets.filter((b) => b.public).length },
        { label: 'Privados', value: buckets.filter((b) => !b.public).length },
        { label: 'Archivos', value: buckets.reduce((sum, b) => sum + b.object_count, 0) },
        { label: 'Uso aproximado', value: formatBytes(buckets.reduce((sum, b) => sum + b.total_bytes, 0)) },
      ],
      rows: buckets.map((b) => ({
        label: b.id,
        value: `${b.object_count} archivos · ${formatBytes(b.total_bytes)}`,
        hint: b.public ? 'público' : 'privado',
      })),
    })

    const tables = data.tables
    metrics.push({
      id: 'database',
      title: 'Base de datos',
      metrics: [
        { label: 'Tablas públicas', value: tables.length },
        { label: 'Con RLS', value: tables.filter((t) => t.rls_enabled).length },
        { label: 'Con organization_id', value: tables.filter((t) => t.has_organization_id).length },
        { label: 'Con branch_id', value: tables.filter((t) => t.has_branch_id).length },
        { label: 'Políticas', value: tables.reduce((sum, t) => sum + t.policies.length, 0) },
        { label: 'Vistas', value: data.views.length },
      ],
      rows: [...tables]
        .sort((a, b) => b.estimated_rows - a.estimated_rows)
        .slice(0, 10)
        .map((t) => ({ label: t.name, value: `~${t.estimated_rows.toLocaleString('es-PY')} filas`, hint: t.rls_enabled ? 'RLS' : 'sin RLS' })),
    })
  }

  metrics.push(...(await collectOrgAndUserMetrics(admin, catalog.available ? catalog.catalog.auth_users : null)))
  metrics.push(await collectGrowthMetrics(admin))

  return { checks, metrics, tenantTables }
}

async function collectOrgAndUserMetrics(
  admin: Admin,
  authUsers: HealthCatalog['auth_users'],
): Promise<HealthMetricGroup[]> {
  // organizations no tiene columna de estado: el estado comercial vive en
  // subscriptions.status (enum subscription_status). Se reutiliza ese sistema.
  const [orgs, subs, members, profiles, branches] = await Promise.all([
    allRows<{ id: string; name: string; plan: string | null }>(admin, 'organizations', 'id, name, plan'),
    allRows<{ organization_id: string; status: string }>(admin, 'subscriptions', 'organization_id, status'),
    allRows<{ organization_id: string }>(admin, 'organization_members', 'organization_id'),
    allRows<{ status: string | null }>(admin, 'profiles', 'status'),
    count(admin, 'branches').catch(() => null),
  ])

  const groups: HealthMetricGroup[] = []

  if (orgs.error) {
    groups.push({
      id: 'organizations',
      title: 'Organizaciones',
      metrics: [{ label: 'Organizaciones', value: null, unavailableReason: orgs.error }],
    })
  } else {
    const statusByOrg = new Map(subs.rows.map((row) => [row.organization_id, row.status]))
    const statusCounts = new Map<string, number>()
    const planCounts = new Map<string, number>()
    for (const org of orgs.rows) {
      const status = statusByOrg.get(org.id) ?? 'sin suscripción'
      statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1)
      const plan = org.plan ?? 'sin plan'
      planCounts.set(plan, (planCounts.get(plan) ?? 0) + 1)
    }
    const active = (statusCounts.get('active') ?? 0) + (statusCounts.get('trialing') ?? 0)
    const suspended = ['suspended', 'past_due', 'canceled', 'cancelled'].reduce((sum, s) => sum + (statusCounts.get(s) ?? 0), 0)
    groups.push({
      id: 'organizations',
      title: 'Organizaciones',
      metrics: [
        { label: 'Total', value: orgs.rows.length },
        { label: 'Activas (active + trialing)', value: subs.error ? null : active, unavailableReason: subs.error ?? undefined },
        { label: 'Suspendidas / vencidas / canceladas', value: subs.error ? null : suspended, unavailableReason: subs.error ?? undefined },
        { label: 'Sucursales', value: branches, unavailableReason: 'No se pudo contar branches.' },
      ],
      rows: [
        ...[...planCounts.entries()].sort((a, b) => b[1] - a[1]).map(([plan, n]) => ({ label: `Plan ${plan}`, value: n, hint: 'organizations.plan' })),
        ...[...statusCounts.entries()].sort((a, b) => b[1] - a[1]).map(([status, n]) => ({ label: `Estado ${status}`, value: n, hint: 'subscriptions.status' })),
      ],
    })
  }

  const inactive = profiles.rows.filter((p) => p.status === 'inactive' || p.status === 'suspended').length
  const perOrg = new Map<string, number>()
  for (const member of members.rows) perOrg.set(member.organization_id, (perOrg.get(member.organization_id) ?? 0) + 1)
  const orgNames = new Map(orgs.rows.map((o) => [o.id, o.name]))

  groups.push({
    id: 'users',
    title: 'Usuarios',
    metrics: [
      ...(authUsers
        ? [
            { label: 'Cuentas (auth)', value: authUsers.total },
            { label: 'Activas últimos 30 días', value: authUsers.signed_in_30d },
            { label: 'Bloqueadas en Auth', value: authUsers.banned },
            { label: 'Nuevas últimos 30 días', value: authUsers.created_30d },
          ]
        : [{ label: 'Cuentas (auth)', value: null, unavailableReason: `Requiere la RPC de ${HEALTH_MIGRATION}.` }]),
      { label: 'Perfiles', value: profiles.error ? null : profiles.rows.length, unavailableReason: profiles.error ?? undefined },
      { label: 'Perfiles desactivados / suspendidos', value: profiles.error ? null : inactive, unavailableReason: profiles.error ?? undefined },
      { label: 'Membresías', value: members.error ? null : members.rows.length, unavailableReason: members.error ?? undefined },
    ],
    rows: [...perOrg.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([orgId, n]) => ({ label: orgNames.get(orgId) ?? 'Organización', value: `${n} miembros` })),
  })

  return groups
}

async function collectGrowthMetrics(admin: Admin): Promise<HealthMetricGroup> {
  // Reutiliza la RPC existente del monitoreo de base de datos (solo lectura;
  // no se llama a record_database_growth_snapshot desde aquí).
  const [size, history] = await Promise.all([
    admin.rpc('get_database_size_info'),
    admin.rpc('get_database_growth_history', { days_back: 30 }),
  ])
  const sizeRow = Array.isArray(size.data) ? (size.data[0] as { total_size_bytes?: number } | undefined) : undefined
  const rows = Array.isArray(history.data) ? (history.data as Array<Record<string, unknown>>) : []
  const points = rows
    .map((row) => ({
      date: String(row.snapshot_date ?? row.date ?? row.recorded_at ?? ''),
      bytes: Number(row.total_size_bytes ?? (Number(row.total_size_mb ?? row.size_mb ?? 0) * 1024 * 1024)),
    }))
    .filter((p) => p.date && Number.isFinite(p.bytes))
    .sort((a, b) => a.date.localeCompare(b.date))
  const growth = points.length >= 2 ? points[points.length - 1].bytes - points[0].bytes : null

  return {
    id: 'growth',
    title: 'Crecimiento de la base',
    metrics: [
      {
        label: 'Tamaño actual',
        value: typeof sizeRow?.total_size_bytes === 'number' ? formatBytes(sizeRow.total_size_bytes) : null,
        unavailableReason: size.error ? errorMessage(size.error) : 'get_database_size_info() sin datos',
      },
      {
        label: `Crecimiento (${points.length} snapshots)`,
        value: growth === null ? null : `${growth >= 0 ? '+' : ''}${formatBytes(growth)}`,
        unavailableReason: history.error
          ? errorMessage(history.error)
          : 'Se necesitan al menos 2 snapshots en database_growth_snapshots (los registra /superadmin/database-monitoring).',
      },
    ],
  }
}

export function formatBytes(bytes: number): string {
  const sign = bytes < 0 ? '-' : ''
  let value = Math.abs(bytes)
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${sign}${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

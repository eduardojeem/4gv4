import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getSuperAdminUser } from '@/lib/superadmin/auth'

type CheckStatus = 'ok' | 'warning' | 'error' | 'skipped'

type CheckResult = {
  id: string
  category: 'auth' | 'database' | 'env' | 'integration' | 'config'
  name: string
  description: string
  status: CheckStatus
  message: string
  latency?: number
  details?: Record<string, unknown>
}

async function runProbe<T>(fn: () => Promise<T>): Promise<{ result: T | null; latency: number; error: string | null }> {
  const start = Date.now()
  try {
    const result = await fn()
    return { result, latency: Date.now() - start, error: null }
  } catch (err) {
    return { result: null, latency: Date.now() - start, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}

export async function GET() {
  const me = await getSuperAdminUser()
  if (!me) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const admin = createAdminSupabase()
  const checks: CheckResult[] = []

  // ── ENV VARS ──────────────────────────────────────────────────────
  const envVars = [
    { key: 'NEXT_PUBLIC_SUPABASE_URL', critical: true },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', critical: true },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', critical: true },
    { key: 'NEXT_PUBLIC_SITE_URL', critical: false },
    { key: 'NEXT_PUBLIC_BASE_DOMAIN', critical: false },
    { key: 'PAGOPAR_PUBLIC_KEY', critical: false },
    { key: 'PAGOPAR_PRIVATE_KEY', critical: false },
  ]
  envVars.forEach(({ key, critical }) => {
    const configured = Boolean(process.env[key])
    checks.push({
      id: `env_${key}`,
      category: 'env',
      name: key,
      description: critical ? 'Variable crítica para autenticación' : 'Variable opcional',
      status: configured ? 'ok' : (critical ? 'error' : 'warning'),
      message: configured ? 'Configurada' : (critical ? 'No definida (crítica)' : 'No definida'),
    })
  })

  // ── AUTH SUPERADMIN ───────────────────────────────────────────────
  checks.push({
    id: 'auth_super_admin',
    category: 'auth',
    name: 'Acceso super admin',
    description: 'getSuperAdminUser() responde correctamente al usuario actual',
    status: 'ok',
    message: `Autenticado como ${me.email ?? me.id}`,
    details: { user_id: me.id, email: me.email ?? null },
  })

  // ── DB CONNECTIVITY ───────────────────────────────────────────────
  const tables = [
    { name: 'organizations',  desc: 'Tabla maestra de tenants' },
    { name: 'profiles',       desc: 'Datos de usuarios' },
    { name: 'user_roles',     desc: 'Roles globales' },
    { name: 'subscriptions',  desc: 'Suscripciones SaaS' },
    { name: 'subscription_plans', desc: 'Catálogo de planes' },
    { name: 'subscription_payments', desc: 'Historial de pagos' },
    { name: 'organization_settings', desc: 'Settings per-tenant' },
    { name: 'organization_members', desc: 'Membresías' },
    { name: 'website_settings', desc: 'Contenido público' },
    { name: 'audit_log',      desc: 'Trazabilidad global' },
    { name: 'system_settings', desc: 'Configuración global' },
  ]
  for (const t of tables) {
    const probe = await runProbe(async () => {
      const r = await admin.from(t.name).select('id', { count: 'exact', head: true })
      return r
    })
    checks.push({
      id: `db_${t.name}`,
      category: 'database',
      name: t.name,
      description: t.desc,
      status: probe.error ? 'error' : 'ok',
      message: probe.error ?? `${probe.result?.count ?? 0} registros · ${probe.latency}ms`,
      latency: probe.latency,
    })
  }

  // ── DATA INTEGRITY ────────────────────────────────────────────────
  const { count: orgCount } = await admin.from('organizations').select('id', { count: 'exact', head: true })
  const { count: settingsCount } = await admin.from('organization_settings').select('organization_id', { count: 'exact', head: true })
  const missingSettings = Math.max(0, (orgCount ?? 0) - (settingsCount ?? 0))

  checks.push({
    id: 'integrity_org_settings',
    category: 'database',
    name: 'Orgs sin settings',
    description: 'organizations sin entrada correspondiente en organization_settings',
    status: missingSettings === 0 ? 'ok' : 'warning',
    message: missingSettings === 0
      ? `Todas las organizaciones tienen settings (${orgCount} OK)`
      : `${missingSettings} organizaciones sin settings de ${orgCount} totales`,
    details: { orgCount, settingsCount, missingSettings },
  })

  // Suscripciones sin org
  const { data: subsWithoutOrg } = await admin
    .from('subscriptions')
    .select('id, organization_id')
    .limit(100)
  const subsOrgIds = (subsWithoutOrg ?? []).map((s) => s.organization_id).filter(Boolean) as string[]
  const { data: existingOrgs } = subsOrgIds.length > 0
    ? await admin.from('organizations').select('id').in('id', subsOrgIds)
    : { data: [] }
  const existingOrgIds = new Set((existingOrgs ?? []).map((o: { id: string }) => o.id))
  const orphanSubs = (subsWithoutOrg ?? []).filter((s) => !existingOrgIds.has(s.organization_id ?? ''))

  checks.push({
    id: 'integrity_orphan_subs',
    category: 'database',
    name: 'Suscripciones huérfanas',
    description: 'subscriptions con organization_id que no existe en organizations',
    status: orphanSubs.length === 0 ? 'ok' : 'error',
    message: orphanSubs.length === 0
      ? 'Sin suscripciones huérfanas'
      : `${orphanSubs.length} suscripciones apuntan a orgs inexistentes`,
    details: { count: orphanSubs.length },
  })

  // ── ROLE INTEGRITY ────────────────────────────────────────────────
  const { count: superAdminCount } = await admin
    .from('user_roles')
    .select('user_id', { count: 'exact', head: true })
    .eq('role', 'super_admin')
    .eq('is_active', true)
  checks.push({
    id: 'role_super_admins',
    category: 'auth',
    name: 'Super admins activos',
    description: 'Debe haber al menos 1 super_admin activo en la plataforma',
    status: (superAdminCount ?? 0) >= 1 ? 'ok' : 'error',
    message: `${superAdminCount ?? 0} super_admin${superAdminCount === 1 ? '' : 's'} activo${superAdminCount === 1 ? '' : 's'}`,
    details: { count: superAdminCount ?? 0 },
  })

  // ── PLAN CATALOG ──────────────────────────────────────────────────
  const { count: activePlans } = await admin
    .from('subscription_plans')
    .select('tier', { count: 'exact', head: true })
    .eq('is_active', true)
  checks.push({
    id: 'plans_catalog',
    category: 'config',
    name: 'Catálogo de planes',
    description: 'subscription_plans debería tener al menos free + 1 plan de pago activos',
    status: (activePlans ?? 0) >= 2 ? 'ok' : 'warning',
    message: `${activePlans ?? 0} planes activos en el catálogo`,
    details: { count: activePlans ?? 0 },
  })

  // ── INTEGRATIONS ──────────────────────────────────────────────────
  const pagoparOk = Boolean(process.env.PAGOPAR_PUBLIC_KEY && process.env.PAGOPAR_PRIVATE_KEY)
  checks.push({
    id: 'integration_pagopar',
    category: 'integration',
    name: 'Pagopar',
    description: 'Credenciales públicas y privadas para procesar pagos',
    status: pagoparOk ? 'ok' : 'warning',
    message: pagoparOk ? 'Configurado y listo para cobrar' : 'Sin credenciales — pagos deshabilitados',
  })

  // ── CRON / SCHEDULED TASKS ────────────────────────────────────────
  // Best-effort: ver si la función expire_trials existe llamando vía RPC con dummy
  const trialFnProbe = await runProbe(async () => {
    return await admin.rpc('expire_trials' as never)
  })
  checks.push({
    id: 'cron_expire_trials',
    category: 'config',
    name: 'Función expire_trials()',
    description: 'Función Postgres que vence trials automáticamente (necesita pg_cron)',
    status: trialFnProbe.error
      ? (trialFnProbe.error.includes('does not exist') || trialFnProbe.error.includes('function')
        ? 'error' : 'warning')
      : 'ok',
    message: trialFnProbe.error
      ? `No disponible: ${trialFnProbe.error}`
      : 'Función disponible',
  })

  // Summary
  const counts = {
    ok:      checks.filter((c) => c.status === 'ok').length,
    warning: checks.filter((c) => c.status === 'warning').length,
    error:   checks.filter((c) => c.status === 'error').length,
    skipped: checks.filter((c) => c.status === 'skipped').length,
    total:   checks.length,
  }

  return NextResponse.json({
    checks,
    counts,
    totalLatency: checks.reduce((sum, c) => sum + (c.latency ?? 0), 0),
    runAt: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}

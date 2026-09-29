import type { SupabaseClient } from '@supabase/supabase-js'
import { errorMessage, runCheck } from '@/lib/health/core'
import { fetchAllRows } from '@/lib/superadmin/fetch-all-rows'
import type { HealthCheckResult } from '@/lib/health/types'

/**
 * Integridad de datos de la plataforma (antes vivía en /superadmin/diagnostic).
 *
 * Todo es de solo lectura. La versión anterior "comprobaba" expire_trials()
 * ejecutándola, lo que vencía suscripciones reales cada vez que se abría la
 * página. Acá se mide el efecto: si hay pruebas o períodos vencidos sin
 * procesar, el ciclo automático no está corriendo.
 */
const STALE_HOURS = 24

async function all<T>(admin: SupabaseClient, table: string, columns: string): Promise<T[]> {
  return fetchAllRows<T>((from, to) =>
    admin.from(table).select(columns).range(from, to) as unknown as PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  )
}

export async function runIntegrityChecks(admin: SupabaseClient): Promise<HealthCheckResult[]> {
  const staleCutoff = new Date(Date.now() - STALE_HOURS * 3_600_000).toISOString()

  return Promise.all([
    runCheck(
      {
        id: 'integrity.org_settings',
        category: 'supabase',
        name: 'Empresas sin configuración',
        description: 'Cada organización necesita su fila en organization_settings; sin ella fallan moneda, recibos y ajustes regionales.',
        method: 'Comparación de todos los id de organizations contra organization_settings.organization_id.',
      },
      async () => {
        const [orgs, settings] = await Promise.all([
          all<{ id: string; name: string }>(admin, 'organizations', 'id, name'),
          all<{ organization_id: string }>(admin, 'organization_settings', 'organization_id'),
        ])
        const withSettings = new Set(settings.map((s) => s.organization_id))
        const missing = orgs.filter((o) => !withSettings.has(o.id))
        return {
          status: missing.length ? 'warning' : 'healthy',
          severity: 'medium',
          summary: missing.length ? `${missing.length} de ${orgs.length} empresas sin configuración` : `Las ${orgs.length} empresas tienen configuración`,
          findings: missing.slice(0, 20).map((o) => o.name),
          recommendation: missing.length ? 'Abrir cada empresa en /superadmin/organizations y guardar su configuración para crear la fila.' : undefined,
        }
      },
    ),
    runCheck(
      {
        id: 'integrity.orphan_subscriptions',
        category: 'payments',
        name: 'Suscripciones huérfanas',
        description: 'Suscripciones que apuntan a una organización que ya no existe.',
        method: 'Todas las filas de subscriptions contra organizations.',
      },
      async () => {
        const [subs, orgs] = await Promise.all([
          all<{ id: string; organization_id: string | null }>(admin, 'subscriptions', 'id, organization_id'),
          all<{ id: string }>(admin, 'organizations', 'id'),
        ])
        const orgIds = new Set(orgs.map((o) => o.id))
        const orphans = subs.filter((s) => !s.organization_id || !orgIds.has(s.organization_id))
        return {
          status: orphans.length ? 'error' : 'healthy',
          severity: 'medium',
          summary: orphans.length ? `${orphans.length} suscripciones sin organización` : `${subs.length} suscripciones, todas con organización`,
          findings: orphans.slice(0, 20).map((s) => `Suscripción ${s.id}`),
        }
      },
    ),
    runCheck(
      {
        id: 'integrity.subscription_lifecycle',
        category: 'payments',
        name: 'Ciclo automático de suscripciones',
        description: `run_subscription_lifecycle() vence pruebas y períodos pagos. Si hay vencimientos de hace más de ${STALE_HOURS} h sin procesar, el proceso programado no está corriendo.`,
        method: 'Cuenta subscriptions en trialing con trial_ends_at vencido y en active con current_period_ends_at vencido. No ejecuta ninguna función.',
      },
      async () => {
        const [trials, periods] = await Promise.all([
          admin.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'trialing').lt('trial_ends_at', staleCutoff),
          admin.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active').lt('current_period_ends_at', staleCutoff),
        ])
        if (trials.error || periods.error) {
          return { status: 'unknown', severity: 'medium', summary: `No se pudo consultar: ${errorMessage(trials.error ?? periods.error)}` }
        }
        const stale = (trials.count ?? 0) + (periods.count ?? 0)
        return {
          status: stale ? 'error' : 'healthy',
          severity: 'high',
          summary: stale ? `${stale} vencimientos sin procesar` : 'Sin vencimientos pendientes',
          findings: [
            `Pruebas vencidas sin procesar: ${trials.count ?? 0}`,
            `Períodos pagos vencidos sin procesar: ${periods.count ?? 0}`,
          ],
          recommendation: stale ? 'Revisar el job programado (pg_cron o cron de Vercel) que llama a run_subscription_lifecycle().' : undefined,
        }
      },
    ),
    runCheck(
      {
        id: 'integrity.super_admins',
        category: 'auth',
        name: 'SuperAdmins activos',
        description: 'Tiene que haber al menos uno; más de tres amplía la superficie de ataque.',
        method: 'user_roles con role = super_admin e is_active.',
      },
      async () => {
        const { count, error } = await admin.from('user_roles').select('user_id', { count: 'exact', head: true }).eq('role', 'super_admin').eq('is_active', true)
        if (error) return { status: 'unknown', severity: 'high', summary: `No se pudo consultar: ${errorMessage(error)}` }
        const n = count ?? 0
        return {
          status: n === 0 ? 'error' : n > 3 ? 'warning' : 'healthy',
          severity: n === 0 ? 'critical' : 'medium',
          summary: `${n} SuperAdmin${n === 1 ? '' : 's'} activo${n === 1 ? '' : 's'}`,
          recommendation: n > 3 ? 'Revisar en /superadmin/users/super-admins si todos siguen necesitando el acceso.' : undefined,
        }
      },
    ),
    runCheck(
      {
        id: 'integrity.plans_catalog',
        category: 'payments',
        name: 'Catálogo de planes',
        description: 'Debe haber al menos un plan gratuito y uno pago activos para que el registro y el upgrade funcionen.',
        method: 'subscription_plans activos y su precio.',
      },
      async () => {
        const { data, error } = await admin.from('subscription_plans').select('name, price, is_active').eq('is_active', true)
        if (error) return { status: 'unknown', severity: 'medium', summary: `No se pudo consultar: ${errorMessage(error)}` }
        const plans = (data ?? []) as Array<{ name: string; price: number | null }>
        const free = plans.filter((p) => !p.price)
        const paid = plans.filter((p) => (p.price ?? 0) > 0)
        return {
          status: free.length && paid.length ? 'healthy' : 'warning',
          severity: 'medium',
          summary: `${plans.length} planes activos (${free.length} gratis, ${paid.length} pagos)`,
          findings: plans.map((p) => `${p.name}: ${p.price ? `Gs. ${Number(p.price).toLocaleString('es-PY')}` : 'gratis'}`),
        }
      },
    ),
  ])
}

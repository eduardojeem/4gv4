import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { MonitoringDashboard, type MonitoringData } from '@/components/superadmin/MonitoringDashboard'

async function getMonitoringData(): Promise<MonitoringData> {
  const admin = createAdminSupabase()

  // ── Run several checks in parallel ────────────────────────────────────
  const start = Date.now()

  const [
    orgsTest, profilesTest, subsTest, paymentsTest,
    recentEvents, errorEvents, suspiciousEvents,
    activeSubs, trialingSubs, pastDueSubs,
    recentSignups, recentLogins,
  ] = await Promise.all([
    // Health probes (count + measure latency)
    measureProbe(async () => await admin.from('organizations').select('id', { count: 'exact', head: true })),
    measureProbe(async () => await admin.from('profiles').select('id', { count: 'exact', head: true })),
    measureProbe(async () => await admin.from('subscriptions').select('id', { count: 'exact', head: true })),
    measureProbe(async () => await admin.from('subscription_payments').select('id', { count: 'exact', head: true })),

    // Recent activity
    admin.from('audit_log').select('id, action, severity, created_at, user_id').order('created_at', { ascending: false }).limit(50),
    // `severity` es texto libre ('low'|'medium'|'high'|'critical'), sin orden
    // numerico. `.gte('severity', 'high')` comparaba alfabeticamente, y
    // 'critical' queda ANTES que 'high' en el alfabeto -la 'c' es menor que
    // la 'h'-, asi que el filtro dejaba afuera justo los eventos mas graves.
    // El contador de "errores 24h" del dashboard los subestimaba en silencio.
    admin.from('audit_log').select('id, action, severity, created_at').in('severity', ['high', 'critical']).order('created_at', { ascending: false }).limit(20),
    admin.from('audit_log').select('id, action, created_at').eq('action', 'suspicious_activity').gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).limit(20),

    // Subscription health
    admin.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'trialing'),
    admin.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'past_due'),

    // Activity last 24h
    admin.from('audit_log').select('id', { count: 'exact', head: true }).eq('action', 'create').eq('resource', 'organizations').gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    admin.from('audit_log').select('id', { count: 'exact', head: true }).eq('action', 'login').gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ])

  const totalLatency = Date.now() - start

  const events = (recentEvents.data ?? []) as Array<{
    id: string; action: string; severity: string | null; created_at: string | null; user_id: string | null
  }>

  // Get unique user_ids for events to look up profiles
  const userIds = Array.from(new Set(events.map((e) => e.user_id).filter(Boolean))) as string[]
  let profilesById = new Map<string, { email: string | null; full_name: string | null }>()
  if (userIds.length > 0) {
    const { data: profiles } = await admin.from('profiles').select('id, email, full_name').in('id', userIds)
    profilesById = new Map(
      ((profiles ?? []) as Array<{ id: string; email: string | null; full_name: string | null }>)
        .map((p) => [p.id, { email: p.email, full_name: p.full_name }])
    )
  }

  const enrichedEvents = events.map((e) => ({
    id: e.id,
    action: e.action,
    severity: e.severity ?? 'low',
    createdAt: e.created_at,
    userId: e.user_id,
    userEmail: e.user_id ? profilesById.get(e.user_id)?.email ?? null : null,
    userName: e.user_id ? profilesById.get(e.user_id)?.full_name ?? null : null,
  }))

  // Errors in last 24h
  const errors24h = ((errorEvents.data ?? []) as Array<{ created_at: string | null }>).filter((e) => {
    return e.created_at && new Date(e.created_at).getTime() >= Date.now() - 24 * 60 * 60 * 1000
  }).length

  // Group events by action for activity chart
  const actionCounts = new Map<string, number>()
  events.forEach((e) => actionCounts.set(e.action, (actionCounts.get(e.action) ?? 0) + 1))
  const topActions = Array.from(actionCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([action, count]) => ({ action, count }))

  return {
    services: [
      { id: 'app', name: 'Next.js App', kind: 'runtime',  status: 'ok', latency: null, detail: 'Server response activo' },
      { id: 'orgs', name: 'organizations', kind: 'table', status: orgsTest.error ? 'error' : 'ok', latency: orgsTest.latency, detail: orgsTest.error ?? `${orgsTest.count ?? 0} registros` },
      { id: 'profiles', name: 'profiles', kind: 'table', status: profilesTest.error ? 'error' : 'ok', latency: profilesTest.latency, detail: profilesTest.error ?? `${profilesTest.count ?? 0} usuarios` },
      { id: 'subs', name: 'subscriptions', kind: 'table', status: subsTest.error ? 'error' : 'ok', latency: subsTest.latency, detail: subsTest.error ?? `${subsTest.count ?? 0} suscripciones` },
      { id: 'payments', name: 'subscription_payments', kind: 'table', status: paymentsTest.error ? 'error' : 'ok', latency: paymentsTest.latency, detail: paymentsTest.error ?? `${paymentsTest.count ?? 0} pagos` },
    ],
    overallLatency: totalLatency,
    activity24h: {
      newOrgs: recentSignups.count ?? 0,
      logins: recentLogins.count ?? 0,
      errors: errors24h,
      suspicious: suspiciousEvents.data?.length ?? 0,
    },
    subscriptions: {
      active: activeSubs.count ?? 0,
      trialing: trialingSubs.count ?? 0,
      pastDue: pastDueSubs.count ?? 0,
    },
    recentEvents: enrichedEvents,
    topActions,
    fetchedAt: new Date().toISOString(),
  }
}

async function measureProbe(fn: () => Promise<{ error: unknown; count: number | null }>): Promise<{ latency: number; count: number | null; error: string | null }> {
  const start = Date.now()
  try {
    const result = await fn()
    return {
      latency: Date.now() - start,
      count: result.count ?? null,
      error: result.error ? String((result.error as { message?: string }).message ?? 'Error') : null,
    }
  } catch (err) {
    return {
      latency: Date.now() - start,
      count: null,
      error: err instanceof Error ? err.message : 'Error desconocido',
    }
  }
}

async function MonitoringContent() {
  const data = await getMonitoringData()
  return <MonitoringDashboard data={data} />
}

export default function SuperAdminMonitoringPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-24">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Ejecutando health checks...</span>
        </div>
      </div>
    }>
      <MonitoringContent />
    </Suspense>
  )
}

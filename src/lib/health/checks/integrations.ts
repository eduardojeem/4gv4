import type { SupabaseClient } from '@supabase/supabase-js'
import { codeAudit, codeAuditMethod } from '@/lib/health/code-audit'
import { HEALTH_MIGRATION, isMissingObjectError } from '@/lib/health/catalog'
import { errorMessage, isConfigured, runCheck } from '@/lib/health/core'
import type { SiteProbe } from '@/lib/health/site-probe'
import type {
  HealthCheckResult,
  HealthMetricGroup,
  ScheduledTaskHealth,
  ServiceConfigurationState,
  ServiceHealthEntry,
} from '@/lib/health/types'

type ServiceConfiguration = Partial<Record<string, ServiceConfigurationState>>

const SERVICE_DEFINITIONS = [
  { id: 'supabase', name: 'Supabase', checkId: 'supabase.database', source: 'NEXT_PUBLIC_SUPABASE_URL + consulta de base de datos' },
  { id: 'upstash', name: 'Upstash', checkId: 'security.rate_limiting', source: 'UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN' },
  { id: 'telegram', name: 'Telegram', checkId: 'integrations.telegram', source: 'TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID' },
  { id: 'turnstile', name: 'Cloudflare Turnstile', checkId: 'security.turnstile', source: 'NEXT_PUBLIC_TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY' },
  { id: 'cloudflare', name: 'Cloudflare', checkId: 'cloudflare.edge', source: 'Headers públicos y API opcional Zone:Read' },
  { id: 'pagopar', name: 'Pagopar', checkId: 'payments.pagopar', source: 'Código, variables requeridas y actividad registrada' },
] as const

function pairConfiguration(first: string, second: string): ServiceConfigurationState {
  const configured = [isConfigured(first), isConfigured(second)].filter(Boolean).length
  return configured === 2 ? 'configured' : configured === 1 ? 'partial' : 'missing'
}

function runtimeServiceConfiguration(): ServiceConfiguration {
  return {
    supabase: pairConfiguration('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'),
    upstash: pairConfiguration('UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'),
    telegram: pairConfiguration('TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'),
    turnstile: pairConfiguration('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY'),
    cloudflare: pairConfiguration('CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ZONE_ID'),
    pagopar: pairConfiguration('PAGOPAR_PUBLIC_KEY', 'PAGOPAR_PRIVATE_KEY'),
  }
}

export function buildServiceHealthEntries(
  checks: HealthCheckResult[],
  configuration: ServiceConfiguration = runtimeServiceConfiguration(),
): ServiceHealthEntry[] {
  const checksById = new Map(checks.map((check) => [check.id, check]))
  const runtime = runtimeServiceConfiguration()

  return SERVICE_DEFINITIONS.map((definition) => {
    const configured = configuration[definition.id] ?? runtime[definition.id] ?? 'missing'
    const check = checksById.get(definition.checkId)
    const status = configured === 'missing' ? 'not_configured' : check?.status ?? 'unknown'
    return {
      id: definition.id,
      name: definition.name,
      configured,
      status,
      summary: configured === 'missing'
        ? 'No configurado'
        : check?.summary ?? 'Configurado, pero sin comprobación automática disponible',
      source: definition.source,
      checkedAt: check?.checkedAt ?? null,
    }
  })
}

export function buildScheduledTaskHealth(
  checks: HealthCheckResult[],
  options: { graceNotificationsConfigured?: boolean } = {},
): ScheduledTaskHealth[] {
  const lifecycle = checks.find((check) => check.id === 'integrity.subscription_lifecycle')
  const graceConfigured = options.graceNotificationsConfigured ?? isConfigured('CRON_SECRET')

  return [
    {
      id: 'subscription-lifecycle',
      name: 'Ciclo de suscripciones',
      status: lifecycle?.status ?? 'unknown',
      summary: lifecycle?.summary ?? 'Sin evidencia del efecto del proceso',
      source: 'Efecto observado en subscriptions; no existe bitácora de ejecución consultable',
      lastRunAt: null,
      nextRunAt: null,
      durationMs: lifecycle?.durationMs ?? null,
    },
    {
      id: 'plan-grace-notifications',
      name: 'Avisos de gracia de planes',
      status: graceConfigured ? 'unknown' : 'not_configured',
      summary: graceConfigured
        ? 'Configurado, pero sin bitácora de ejecución consultable'
        : 'CRON_SECRET no configurado',
      source: 'Ruta /api/cron/plan-grace-notifications y presencia de CRON_SECRET',
      lastRunAt: null,
      nextRunAt: null,
      durationMs: null,
    },
  ]
}

/**
 * Proveedores de pago conocidos. Solo se reportan como "implementados" los
 * que tienen código en src/app/api/payments/<proveedor> (detectado en build);
 * el resto aparece como no implementado, sin inventar estado.
 */
const PAYMENT_PROVIDERS: Record<string, { label: string; env: string[] }> = {
  pagopar: { label: 'Pagopar', env: ['PAGOPAR_PUBLIC_KEY', 'PAGOPAR_PRIVATE_KEY'] },
  mercadopago: { label: 'Mercado Pago', env: ['MERCADOPAGO_ACCESS_TOKEN'] },
}

/** Sin webhooks en este plazo se reporta advertencia (solo si hubo pagos que los esperaban). */
const WEBHOOK_STALE_DAYS = 30

type WebhookEvent = { provider: string; endpoint: string; outcome: string; http_status: number; error_code: string | null; received_at: string }

async function loadWebhookEvents(admin: SupabaseClient) {
  const { data, error } = await admin
    .from('payment_webhook_events')
    .select('provider, endpoint, outcome, http_status, error_code, received_at')
    .order('received_at', { ascending: false })
    .limit(200)
  if (error) {
    return {
      available: false as const,
      reason: isMissingObjectError(error) ? `Tabla payment_webhook_events inexistente: aplicar ${HEALTH_MIGRATION}.` : errorMessage(error),
    }
  }
  return { available: true as const, events: (data ?? []) as WebhookEvent[] }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-PY', { timeZone: 'America/Asuncion', dateStyle: 'short', timeStyle: 'short' })
}

export async function runIntegrationChecks(
  admin: SupabaseClient,
  probe: SiteProbe,
): Promise<{ checks: HealthCheckResult[]; metrics: HealthMetricGroup[] }> {
  const webhookEvents = await loadWebhookEvents(admin)
  const implemented = new Map(codeAudit.paymentProviders.map((p) => [p.provider, p]))

  const paymentChecks = Object.entries(PAYMENT_PROVIDERS).map(([id, provider]) =>
    runCheck(
      {
        id: `payments.${id}`,
        category: 'payments',
        name: provider.label,
        description: `Credenciales, webhook y actividad reciente de ${provider.label}. Nunca se ejecutan cobros desde este panel.`,
        method: `${codeAuditMethod()} Presencia de ${provider.env.join(', ')} (sin leer valores). Últimos pagos en subscription_payments (provider='${id}').`,
      },
      async () => {
        const code = implemented.get(id)
        if (!code) {
          return {
            status: 'not_configured',
            severity: 'info',
            summary: 'No implementado en el código',
            findings: [`No existe src/app/api/payments/${id}.`],
          }
        }
        const missingEnv = provider.env.filter((key) => !isConfigured(key))
        const [lastPaid, lastFailed] = await Promise.all([
          admin.from('subscription_payments').select('paid_at, created_at').eq('provider', id).eq('status', 'paid').order('paid_at', { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
          admin.from('subscription_payments').select('created_at').eq('provider', id).eq('status', 'failed').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        ])
        const lastEvent = webhookEvents.available ? webhookEvents.events.find((e) => e.provider === id) : undefined
        const lastError = webhookEvents.available ? webhookEvents.events.find((e) => e.provider === id && e.outcome !== 'processed' && e.outcome !== 'ignored') : undefined
        const findings = [
          `Credenciales: ${missingEnv.length ? `faltan ${missingEnv.join(', ')}` : 'configuradas'}`,
          `Webhook: ${code.webhookRoutes.length ? code.webhookRoutes.join(', ') : 'sin ruta de webhook'}`,
          `Último pago aplicado: ${lastPaid.error ? errorMessage(lastPaid.error) : formatDate((lastPaid.data as { paid_at?: string } | null)?.paid_at)}`,
          `Último pago fallido: ${lastFailed.error ? errorMessage(lastFailed.error) : formatDate((lastFailed.data as { created_at?: string } | null)?.created_at)}`,
          webhookEvents.available
            ? `Último evento de webhook: ${lastEvent ? `${formatDate(lastEvent.received_at)} (${lastEvent.outcome})` : 'ninguno registrado'}`
            : `Último evento de webhook: no disponible (${webhookEvents.reason})`,
          ...(lastError ? [`Último error de webhook: ${formatDate(lastError.received_at)} · HTTP ${lastError.http_status} · ${lastError.error_code ?? lastError.outcome}`] : []),
        ]
        return {
          status: missingEnv.length ? 'error' : code.webhookRoutes.length === 0 ? 'warning' : lastError && lastError === lastEvent ? 'warning' : 'healthy',
          severity: 'high',
          summary: missingEnv.length ? 'Implementado pero sin credenciales' : lastError && lastError === lastEvent ? 'El último webhook falló' : 'Configurado',
          findings,
          recommendation: missingEnv.length ? `Configurar ${missingEnv.join(', ')} en Vercel (Production).` : undefined,
        }
      },
    ),
  )

  const checks = await Promise.all([
    ...paymentChecks,
    runCheck(
      {
        id: 'webhooks.payments',
        category: 'webhooks',
        name: 'Webhooks de pago',
        description: 'Recepción y procesamiento de notificaciones de los proveedores. Se registra resultado y código HTTP, nunca payload ni firma.',
        method: `Tabla payment_webhook_events (últimos 200 eventos). ${codeAuditMethod()}`,
      },
      async () => {
        const routes = codeAudit.paymentProviders.flatMap((p) => p.webhookRoutes)
        if (routes.length === 0) return { status: 'not_configured', severity: 'info', summary: 'No hay rutas de webhook' }
        if (!webhookEvents.available) {
          return { status: 'unknown', severity: 'medium', summary: 'No disponible', findings: [webhookEvents.reason], recommendation: `Aplicar ${HEALTH_MIGRATION}.` }
        }
        const findings: string[] = []
        let stale = false
        let failing = false
        for (const route of routes) {
          const events = webhookEvents.events.filter((e) => e.endpoint === route)
          const last = events[0]
          const lastOk = events.find((e) => e.outcome === 'processed')
          const lastErr = events.find((e) => e.outcome === 'error' || e.outcome === 'rejected')
          if (!last) {
            findings.push(`${route}: sin recepciones registradas`)
            continue
          }
          if (Date.now() - new Date(last.received_at).getTime() > WEBHOOK_STALE_DAYS * 86_400_000) stale = true
          if (lastErr && lastErr === last) failing = true
          findings.push(
            `${route}: última recepción ${formatDate(last.received_at)} · último OK ${formatDate(lastOk?.received_at)} · último error ${lastErr ? `${formatDate(lastErr.received_at)} (${lastErr.error_code ?? lastErr.outcome}, HTTP ${lastErr.http_status})` : '—'}`,
          )
        }
        const none = webhookEvents.events.length === 0
        return {
          status: failing ? 'error' : stale ? 'warning' : 'healthy',
          severity: failing ? 'high' : stale ? 'medium' : 'info',
          summary: failing
            ? 'El último webhook recibido falló'
            : none
              ? 'Sin eventos registrados todavía (en espera de transacciones)'
              : stale
                ? `Sin webhooks en ${WEBHOOK_STALE_DAYS} días`
                : 'Recibiendo y procesando',
          findings,
          recommendation: failing
            ? 'Revisar el error_code y la configuración de la URL de notificación en el panel del proveedor.'
            : undefined,
        }
      },
    ),
    runCheck(
      {
        id: 'analytics.ga4',
        category: 'analytics',
        name: 'Google Analytics 4',
        description: 'Medición externa de tráfico. La plataforma ya tiene analítica propia (site_analytics_events).',
        method: `Variable NEXT_PUBLIC_GA_MEASUREMENT_ID (solo presencia) y ${codeAuditMethod()}`,
      },
      async () => {
        const env = isConfigured('NEXT_PUBLIC_GA_MEASUREMENT_ID')
        const code = codeAudit.ga4Files.length > 0
        return {
          status: env && code ? 'healthy' : env || code ? 'warning' : 'not_configured',
          severity: 'info',
          summary: env && code ? 'Configurado' : env ? 'Variable definida pero el código no carga gtag' : code ? 'Código presente sin variable' : 'No configurado',
          findings: ['Analítica propia activa: site_analytics_events (ver /superadmin/visitas).', ...codeAudit.ga4Files],
          recommendation: env && code ? undefined : 'Opcional: agregar @next/third-parties/google con NEXT_PUBLIC_GA_MEASUREMENT_ID, condicionado al consentimiento de cookies.',
        }
      },
    ),
    runCheck(
      {
        id: 'cloudflare.edge',
        category: 'cloudflare',
        name: 'Cloudflare',
        description: 'Solo se afirma lo verificable desde fuera: si el dominio pasa por Cloudflare (cf-ray / server). Tener Cloudflare no implica que WAF, bot fight o reglas estén activos.',
        method: `Headers de ${probe.origin}/saas. Si existen CLOUDFLARE_API_TOKEN y CLOUDFLARE_ZONE_ID se leen los settings de la zona (solo lectura).`,
      },
      async () => {
        const home = await probe.get('/saas')
        const proxied = Boolean(home.headers.get('cf-ray')) || /cloudflare/i.test(home.headers.get('server') ?? '')
        const challengedPaths: string[] = []
        for (const path of ['/login', '/register']) {
          if ((await probe.get(path)).challenged) challengedPaths.push(path)
        }
        const findings = [
          `Proxy de Cloudflare: ${proxied ? 'sí (cf-ray presente)' : 'no detectado'}`,
          `Servidor: ${home.headers.get('server') ?? '—'}`,
          challengedPaths.length
            ? `Desafío anti-bots activo en ${challengedPaths.join(', ')} (cf-mitigated: challenge para clientes automatizados).`
            : 'No se detectó desafío anti-bots en /login ni /register para clientes automatizados.',
        ]
        const token = process.env.CLOUDFLARE_API_TOKEN?.trim()
        const zone = process.env.CLOUDFLARE_ZONE_ID?.trim()
        if (token && zone) {
          try {
            const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zone)}/settings`, {
              headers: { Authorization: `Bearer ${token}` },
              cache: 'no-store',
              signal: AbortSignal.timeout(8_000),
            })
            const json = (await response.json()) as { success?: boolean; result?: Array<{ id: string; value: unknown }> }
            if (json.success && json.result) {
              const pick = (id: string) => json.result?.find((s) => s.id === id)?.value
              findings.push(
                `SSL: ${String(pick('ssl') ?? '—')} · Always HTTPS: ${String(pick('always_use_https') ?? '—')} · TLS mínimo: ${String(pick('min_tls_version') ?? '—')} · Security level: ${String(pick('security_level') ?? '—')}`,
              )
            } else {
              findings.push(`API de Cloudflare respondió ${response.status}`)
            }
          } catch (error) {
            findings.push(`API de Cloudflare: ${errorMessage(error)}`)
          }
        } else {
          findings.push('API de Cloudflare no configurada (opcional): CLOUDFLARE_API_TOKEN con permiso Zone:Read y CLOUDFLARE_ZONE_ID.')
        }
        return {
          status: home.status === 0 ? 'unknown' : proxied ? 'healthy' : 'not_configured',
          severity: 'info',
          summary: home.status === 0 ? 'Sitio no alcanzable' : proxied ? 'Tráfico pasando por Cloudflare' : 'Cloudflare no detectado',
          findings,
        }
      },
    ),
    runCheck(
      {
        id: 'deployment.env',
        category: 'deployment',
        name: 'Variables de entorno requeridas',
        description: 'Solo se informa si cada variable existe. Los valores nunca salen del servidor.',
        method: 'process.env en el runtime actual.',
      },
      async () => {
        const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SITE_URL', 'PUBLIC_SESSION_SECRET', 'REPAIR_QR_SECRET', 'CRON_SECRET']
        const recommended = ['NEXT_PUBLIC_BASE_URL', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'RESEND_API_KEY', 'EMAIL_FROM', 'NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY']
        const missingRequired = required.filter((k) => !isConfigured(k))
        const missingRecommended = recommended.filter((k) => !isConfigured(k))
        return {
          status: missingRequired.length ? 'error' : missingRecommended.length ? 'warning' : 'healthy',
          severity: missingRequired.length ? 'high' : 'medium',
          summary: `${required.length - missingRequired.length}/${required.length} requeridas · ${recommended.length - missingRecommended.length}/${recommended.length} recomendadas`,
          findings: [
            ...required.map((k) => `${isConfigured(k) ? '✓' : '✕'} ${k} ${isConfigured(k) ? 'configurada' : 'faltante'}`),
            ...recommended.map((k) => `${isConfigured(k) ? '✓' : '⚠'} ${k} ${isConfigured(k) ? 'configurada' : 'faltante'}`),
          ],
        }
      },
    ),
    runCheck(
      {
        id: 'deployment.error_handling',
        category: 'deployment',
        name: 'Manejo de errores y logging',
        description: 'Error boundaries de Next.js y destino de logs de producción.',
        method: `${codeAuditMethod()} Verificación de tabla system_error_logs en Supabase, alertas de Telegram o servicio externo (Sentry / Axiom / Better Stack).`,
      },
      async () => {
        const boundaries = codeAudit.errorBoundaries
        const hasGlobal = boundaries.some((f) => f.endsWith('global-error.tsx'))
        const hasTelegram = isConfigured('TELEGRAM_BOT_TOKEN') && isConfigured('TELEGRAM_CHAT_ID')
        const hasExternalService =
          isConfigured('SENTRY_DSN') ||
          isConfigured('NEXT_PUBLIC_SENTRY_DSN') ||
          isConfigured('AXIOM_TOKEN') ||
          isConfigured('LOGTAIL_SOURCE_TOKEN')

        // Chequear presencia de la tabla system_error_logs en Supabase
        const { error: dbErr } = await admin.from('system_error_logs').select('id').limit(1)
        const hasDbLogging = !dbErr

        const hasLoggingDestination = hasDbLogging || hasTelegram || hasExternalService

        const destinations: string[] = []
        if (hasDbLogging) destinations.push('Supabase (system_error_logs)')
        if (hasTelegram) destinations.push('Alertas en Telegram')
        if (isConfigured('SENTRY_DSN') || isConfigured('NEXT_PUBLIC_SENTRY_DSN')) destinations.push('Sentry')
        if (isConfigured('AXIOM_TOKEN')) destinations.push('Axiom')
        if (isConfigured('LOGTAIL_SOURCE_TOKEN')) destinations.push('Better Stack')

        const summaryDest = destinations.length > 0
          ? `logs retenidos en ${destinations.join(' + ')}`
          : 'logs solo en consola de Vercel'

        return {
          status: hasGlobal && hasLoggingDestination ? 'healthy' : hasGlobal ? 'warning' : 'error',
          severity: hasGlobal ? 'low' : 'medium',
          summary: `${boundaries.length} error boundaries · ${summaryDest}`,
          findings: [
            ...boundaries,
            ...(destinations.length > 0
              ? [`✓ Destino de errores configurado: ${destinations.join(', ')}.`]
              : [
                  'Sin destino persistente de errores: los errores de producción solo quedan en los logs efímeros de Vercel.',
                  'Aplica la migración 20261006120000_system_error_logs.sql en Supabase para retener incidencias, o configura TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID.',
                ]),
          ],
          recommendation: hasLoggingDestination
            ? undefined
            : 'Aplicar la migración de system_error_logs en Supabase o configurar alertas de Telegram para retener errores.',
        }
      },
    ),
    runCheck(
      {
        id: 'deployment.backups',
        category: 'deployment',
        name: 'Backups / recuperación',
        description: 'Backups diarios y Point-in-Time Recovery dependen del plan de Supabase.',
        method: 'Requiere la Management API de Supabase (SUPABASE_ACCESS_TOKEN), no configurada.',
      },
      async () => ({
        status: 'unknown',
        severity: 'info',
        summary: 'No verificable automáticamente',
        findings: ['Revisar en Supabase Dashboard → Database → Backups que existan backups recientes y, si el plan lo permite, PITR.'],
        recommendation: 'Probar una restauración en un proyecto de staging al menos una vez antes del lanzamiento.',
      }),
    ),
  ])

  const commit = process.env.VERCEL_GIT_COMMIT_SHA
  const metrics: HealthMetricGroup[] = [
    {
      id: 'deployment',
      title: 'Deployment',
      metrics: [
        { label: 'Entorno', value: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null },
        { label: 'Plataforma', value: process.env.VERCEL ? 'Vercel' : 'Local / otro' },
        { label: 'Región', value: process.env.VERCEL_REGION ?? null, unavailableReason: 'VERCEL_REGION solo existe en Vercel.' },
        { label: 'Commit', value: commit ? commit.slice(0, 7) : null, unavailableReason: 'VERCEL_GIT_COMMIT_SHA solo existe en builds de Vercel.' },
        { label: 'Rama', value: process.env.VERCEL_GIT_COMMIT_REF ?? null, unavailableReason: 'VERCEL_GIT_COMMIT_REF solo existe en builds de Vercel.' },
        { label: 'Build (manifiesto)', value: formatDate(codeAudit.generatedAt) },
        { label: 'Host del deploy', value: process.env.VERCEL_URL ?? null, unavailableReason: 'VERCEL_URL solo existe en Vercel.' },
        { label: 'URL canónica', value: probe.origin },
      ],
    },
  ]

  return { checks, metrics }
}

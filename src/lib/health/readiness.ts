import type { HealthCheckResult, HealthStatus } from '@/lib/health/types'

/**
 * Checklist "Preparación para producción". Módulo puro (sin acceso a env ni a
 * Supabase): lo usa el Client Component para agrupar los resultados reales.
 *
 * Un ítem solo queda aprobado si TODOS sus checks están `healthy`. `unknown`
 * (no verificable) nunca cuenta como aprobado.
 */
export interface ReadinessItem {
  id: string
  label: string
  checkIds: string[]
  /** Ítems opcionales: `not_configured` no bloquea el lanzamiento. */
  optional?: boolean
}

export const READINESS_ITEMS: ReadinessItem[] = [
  { id: 'privacy', label: 'Política de privacidad', checkIds: ['legal.privacy'] },
  { id: 'terms', label: 'Términos y condiciones', checkIds: ['legal.terms'] },
  { id: 'secrets', label: 'API y secretos', checkIds: ['security.secrets', 'deployment.env'] },
  { id: 'https', label: 'HTTPS', checkIds: ['security.https'] },
  { id: 'cookies', label: 'Cookie Banner', checkIds: ['legal.cookies'] },
  { id: 'meta', label: 'Meta descriptions', checkIds: ['seo.meta_description'] },
  { id: 'og', label: 'Preview social', checkIds: ['seo.open_graph'] },
  { id: 'favicon', label: 'Favicon', checkIds: ['seo.favicon'] },
  { id: 'sitemap', label: 'Sitemap', checkIds: ['seo.sitemap'] },
  { id: 'robots', label: 'robots.txt', checkIds: ['seo.robots'] },
  { id: 'alt', label: 'ALT imágenes', checkIds: ['seo.image_alt'] },
  { id: 'images', label: 'Compresión de imágenes', checkIds: ['performance.images'] },
  { id: 'speed', label: 'Velocidad de carga', checkIds: ['performance.response_time', 'performance.heavy_resources'] },
  { id: 'contrast', label: 'Contraste', checkIds: ['ux.contrast'] },
  { id: 'responsive', label: 'Responsive', checkIds: ['ux.mobile'] },
  { id: '404', label: 'Página 404', checkIds: ['ux.not_found'] },
  { id: 'links', label: 'Enlaces rotos', checkIds: ['ux.broken_links'] },
  { id: 'forms', label: 'Formularios', checkIds: ['ux.forms'] },
  { id: 'spam', label: 'Protección SPAM', checkIds: ['security.spam'] },
  { id: 'ga4', label: 'GA4', checkIds: ['analytics.ga4'], optional: true },
  { id: 'cta', label: 'CTA', checkIds: ['ux.cta'] },
  { id: 'rls', label: 'RLS', checkIds: ['tenancy.rls'] },
  { id: 'tenancy', label: 'Aislamiento multi-tenant', checkIds: ['tenancy.policies', 'tenancy.views'] },
  { id: 'auth', label: 'Autenticación', checkIds: ['supabase.auth'] },
  { id: 'superadmin', label: 'Protección SuperAdmin', checkIds: ['security.superadmin_protection', 'security.admin_api_guards'] },
  { id: 'storage', label: 'Storage', checkIds: ['supabase.storage', 'storage.public_buckets'] },
  { id: 'backups', label: 'Backups / recuperación', checkIds: ['deployment.backups'] },
  { id: 'payments', label: 'Pagos', checkIds: ['payments.pagopar'] },
  { id: 'webhooks', label: 'Webhooks', checkIds: ['webhooks.payments'] },
  { id: 'turnstile', label: 'Turnstile', checkIds: ['security.turnstile'] },
  { id: 'ratelimit', label: 'Rate limiting', checkIds: ['security.rate_limiting'] },
  { id: 'errors', label: 'Manejo de errores', checkIds: ['deployment.error_handling'] },
  { id: 'logging', label: 'Logging', checkIds: ['deployment.error_handling', 'performance.production_errors'] },
]

export interface ReadinessRow {
  item: ReadinessItem
  status: HealthStatus
  approved: boolean
  checks: HealthCheckResult[]
}

const RANK: HealthStatus[] = ['error', 'warning', 'unknown', 'not_configured', 'healthy']

export function evaluateReadiness(checks: HealthCheckResult[]): { rows: ReadinessRow[]; approved: number; total: number } {
  const byId = new Map(checks.map((check) => [check.id, check]))
  const rows = READINESS_ITEMS.map((item) => {
    const matched = item.checkIds.map((id) => byId.get(id)).filter((c): c is HealthCheckResult => Boolean(c))
    const statuses: HealthStatus[] = matched.length === item.checkIds.length
      ? matched.map((c) => c.status)
      : [...matched.map((c) => c.status), 'unknown']
    const status = RANK.find((s) => statuses.includes(s)) ?? 'unknown'
    const approved = status === 'healthy' || (Boolean(item.optional) && status === 'not_configured')
    return { item, status, approved, checks: matched }
  })
  return { rows, approved: rows.filter((r) => r.approved).length, total: rows.length }
}

import type {
  HealthCategory,
  HealthCheckResult,
  HealthSeverity,
  HealthStatus,
} from '@/lib/health/types'

/**
 * Reglas de severidad (documentadas; la UI las muestra en la pestaña de ayuda).
 *
 * La severidad describe el impacto técnico si el hallazgo es real, no la
 * probabilidad. Solo aplica a estados warning/error/not_configured; un check
 * healthy siempre se reporta como `info`.
 */
export const SEVERITY_RULES: Record<HealthSeverity, string[]> = {
  critical: [
    'Posible lectura o escritura entre organizaciones (RLS desactivado o política sin filtro en tabla con organization_id).',
    'Un secreto de servidor aparece en HTML/JS público.',
    'Una ruta /superadmin o /api/superadmin responde sin autenticación.',
    'La base de datos no responde.',
  ],
  high: [
    'Endpoint administrativo sin autorización adecuada detectada en el código.',
    'Bucket con datos sensibles configurado como público.',
    'Archivos de datos (CSV/XLSX/SQL) accesibles públicamente.',
    'Auth o Storage de Supabase no responden.',
    'Proveedor de pagos implementado pero sin credenciales o con errores de webhook.',
    'Vista pública que omite RLS (sin security_invoker) con datos por organización.',
  ],
  medium: [
    'Rate limiting ausente o no compartido entre instancias.',
    'Security headers o HTTPS incompletos.',
    'Falta política de privacidad, términos o aviso de cookies.',
    'Protección anti-bots (Turnstile) no configurada en producción.',
    'Enlaces rotos o página 404 incorrecta.',
  ],
  low: [
    'Imagen sin ALT, meta description u Open Graph faltante.',
    'Recursos pesados o imágenes sin optimizar.',
    'Sitemap/robots con URLs de otro host.',
  ],
  info: [
    'Integraciones opcionales no configuradas (GA4, API de Cloudflare, logs externos).',
    'Comprobaciones que requieren revisión manual.',
  ],
}

type CheckInput = {
  id: string
  category: HealthCategory
  name: string
  description: string
  method: string
}

type Outcome = {
  status: HealthStatus
  /** Severidad si no está sano. Se fuerza a `info` cuando status es healthy. */
  severity: HealthSeverity
  summary: string
  findings?: string[]
  recommendation?: string
  metadata?: HealthCheckResult['metadata']
}

export function buildResult(input: CheckInput, outcome: Outcome, durationMs?: number): HealthCheckResult {
  return {
    ...input,
    status: outcome.status,
    severity: outcome.status === 'healthy' ? 'info' : outcome.severity,
    summary: sanitizeMessage(outcome.summary),
    findings: (outcome.findings ?? []).map(sanitizeMessage),
    recommendation: outcome.recommendation,
    metadata: outcome.metadata,
    durationMs,
    checkedAt: new Date().toISOString(),
  }
}

/**
 * Ejecuta un check con tiempo límite. Un check que lanza o expira nunca se
 * reporta como sano: queda `unknown` con el error saneado.
 */
export async function runCheck(
  input: CheckInput,
  fn: () => Promise<Outcome>,
  timeoutMs = 15_000,
): Promise<HealthCheckResult> {
  const start = Date.now()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const outcome = await Promise.race([
      fn(),
      new Promise<Outcome>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Tiempo agotado (${timeoutMs} ms)`)), timeoutMs)
      }),
    ])
    return buildResult(input, outcome, Date.now() - start)
  } catch (error) {
    return buildResult(
      input,
      {
        status: 'unknown',
        severity: 'medium',
        summary: `No se pudo completar la comprobación: ${errorMessage(error)}`,
      },
      Date.now() - start,
    )
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return sanitizeMessage(error.message)
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return sanitizeMessage(error.message)
  }
  return 'Error desconocido'
}

const SECRET_PATTERNS: RegExp[] = [
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g, // JWT (service role, anon)
  /\bsb_(secret|publishable)_[A-Za-z0-9_-]+/g,
  /\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]+/g,
  /\bre_[A-Za-z0-9]{16,}/g, // Resend
  /(apikey|api_key|token|secret|password|authorization)=([^&\s]+)/gi,
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /postgres(ql)?:\/\/[^\s]+/gi,
]

/**
 * Quita del texto cualquier cosa con forma de credencial antes de mandarlo al
 * navegador o guardarlo en el historial. Además corta mensajes largos.
 */
export function sanitizeMessage(message: string): string {
  let clean = message
  for (const pattern of SECRET_PATTERNS) {
    clean = clean.replace(pattern, (match, ...groups) => {
      if (/=/.test(match) && typeof groups[0] === 'string') return `${groups[0]}=[oculto]`
      return '[oculto]'
    })
  }
  // Valores de variables privadas que pudieran colarse en un mensaje de error.
  for (const value of privateEnvValues()) {
    if (value.length >= 8 && clean.includes(value)) clean = clean.split(value).join('[oculto]')
  }
  return clean.length > 400 ? `${clean.slice(0, 397)}...` : clean
}

const PRIVATE_ENV_KEYS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'PAGOPAR_PRIVATE_KEY',
  'TURNSTILE_SECRET_KEY',
  'UPSTASH_REDIS_REST_TOKEN',
  'RESEND_API_KEY',
  'CRON_SECRET',
  'PUBLIC_SESSION_SECRET',
  'REPAIR_QR_SECRET',
  'CLOUDFLARE_API_TOKEN',
  'VERCEL_API_TOKEN',
]

function privateEnvValues(): string[] {
  return PRIVATE_ENV_KEYS.map((key) => process.env[key]?.trim() ?? '').filter(Boolean)
}

export function isConfigured(key: string): boolean {
  return Boolean(process.env[key]?.trim())
}

export function worstStatus(statuses: HealthStatus[]): HealthStatus {
  if (statuses.includes('error')) return 'error'
  if (statuses.includes('warning')) return 'warning'
  if (statuses.includes('unknown')) return 'unknown'
  if (statuses.includes('not_configured')) return 'not_configured'
  return 'healthy'
}

const SEVERITY_ORDER: HealthSeverity[] = ['critical', 'high', 'medium', 'low', 'info']

export function worstSeverity(severities: HealthSeverity[]): HealthSeverity {
  for (const severity of SEVERITY_ORDER) {
    if (severities.includes(severity)) return severity
  }
  return 'info'
}

export function compareSeverity(a: HealthSeverity, b: HealthSeverity): number {
  return SEVERITY_ORDER.indexOf(a) - SEVERITY_ORDER.indexOf(b)
}

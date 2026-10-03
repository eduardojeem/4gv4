import { randomUUID } from 'node:crypto'
import { codeAudit, codeAuditMethod, mutatingOperations } from '@/lib/health/code-audit'
import { isConfigured, runCheck } from '@/lib/health/core'
import {
  PUBLIC_PAGES,
  isImageOptimizerUnavailable,
  isExpectedProtectedResponse,
  parseHtml,
  probeFailureStatus,
  type ParsedHtml,
  type ProbeResponse,
  type SiteProbe,
} from '@/lib/health/site-probe'
import { median, percentile } from '@/lib/health/statistics'
import type { HealthCheckResult, HealthMetricGroup } from '@/lib/health/types'

const PROBE_NOTE = 'Solo se analiza el HTML que entrega el servidor; el contenido que se agrega en el navegador no se ve.'
const IMAGE_BUDGET_BYTES = 200 * 1024

type PageSnapshot = { path: string; response: ProbeResponse; html: ParsedHtml | null }

async function loadPages(probe: SiteProbe): Promise<PageSnapshot[]> {
  return Promise.all(
    PUBLIC_PAGES.map(async (path) => {
      const response = await probe.get(path)
      const isHtml = (response.headers.get('content-type') ?? '').includes('text/html')
      return { path, response, html: response.ok && isHtml ? parseHtml(response.body) : null }
    }),
  )
}

function describeStatus(response: ProbeResponse): string {
  if (response.challenged) return 'desafío de Cloudflare (no verificable por el diagnóstico)'
  return response.error ?? `HTTP ${response.status}`
}

function unreachable(pages: PageSnapshot[]): string[] {
  return pages.filter((page) => !page.html).map((page) => `${page.path}: ${describeStatus(page.response)}`)
}

/** Error real del sitio: excluye los desafíos de Cloudflare, que son protección, no fallas. */
function isHttpFailure(response: ProbeResponse): boolean {
  return !response.challenged && (response.status >= 400 || response.status === 0)
}

/** Valores de variables privadas: se usan solo para buscar fugas, nunca salen de esta función. */
const PRIVATE_KEYS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'PAGOPAR_PRIVATE_KEY',
  'TURNSTILE_SECRET_KEY',
  'UPSTASH_REDIS_REST_TOKEN',
  'RESEND_API_KEY',
  'CRON_SECRET',
  'PUBLIC_SESSION_SECRET',
  'REPAIR_QR_SECRET',
]

const LEGAL_CANDIDATES = {
  privacy: ['/privacidad', '/politica-de-privacidad', '/saas/privacidad', '/legal/privacidad', '/privacy'],
  terms: ['/terminos', '/terminos-y-condiciones', '/saas/terminos', '/legal/terminos', '/terms'],
}

export async function runWebChecks(probe: SiteProbe): Promise<{ checks: HealthCheckResult[]; metrics: HealthMetricGroup[] }> {
  const pages = await loadPages(probe)
  const reachable = pages.filter((page) => page.html) as Array<PageSnapshot & { html: ParsedHtml }>
  const home = reachable.find((page) => page.path === '/saas') ?? reachable[0]
  const pageList = PUBLIC_PAGES.join(', ')
  const htmlMethod = `GET anónimo a ${pageList} en ${probe.origin}. ${PROBE_NOTE}`

  const noPages = async () => ({
    status: 'unknown' as const,
    severity: 'medium' as const,
    summary: `No se pudo leer ninguna página pública de ${probe.origin}`,
    findings: unreachable(pages),
  })

  const checks = await Promise.all([
    // ------------------------------------------------------------------ Seguridad
    runCheck(
      {
        id: 'security.https',
        category: 'security',
        name: 'HTTPS activo',
        description: 'El dominio canónico debe servirse por HTTPS y redirigir HTTP → HTTPS, con HSTS.',
        method: `URL canónica (NEXT_PUBLIC_SITE_URL), GET a http:// sin seguir redirecciones y header Strict-Transport-Security de ${probe.origin}/saas.`,
      },
      async () => {
        const url = new URL(probe.origin)
        if (url.protocol !== 'https:') {
          return {
            status: 'error',
            severity: 'medium',
            summary: `La URL canónica usa ${url.protocol.replace(':', '')}`,
            findings: [`NEXT_PUBLIC_SITE_URL apunta a ${probe.origin}`],
            recommendation: 'Configurar NEXT_PUBLIC_SITE_URL con https:// en producción.',
          }
        }
        const findings: string[] = []
        let redirectOk = false
        try {
          const insecure = await fetch(`http://${url.host}/`, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(8_000) })
          const location = insecure.headers.get('location') ?? ''
          redirectOk = insecure.status >= 300 && insecure.status < 400 && location.startsWith('https://')
          if (!redirectOk) findings.push(`http://${url.host}/ respondió ${insecure.status} sin redirigir a HTTPS`)
        } catch {
          findings.push('No se pudo conectar por HTTP (puede estar cerrado, lo cual es aceptable).')
          redirectOk = true
        }
        const hsts = home?.response.headers.get('strict-transport-security')
        if (!hsts) findings.push('Falta el header Strict-Transport-Security.')
        return {
          status: redirectOk && hsts ? 'healthy' : 'warning',
          severity: 'medium',
          summary: redirectOk && hsts ? 'HTTPS con redirección y HSTS' : 'HTTPS incompleto',
          findings,
          recommendation: findings.length ? 'Activar "Always Use HTTPS" (Cloudflare/Vercel) y mantener HSTS en next.config.ts.' : undefined,
        }
      },
    ),
    runCheck(
      {
        id: 'security.headers',
        category: 'security',
        name: 'Security headers',
        description: 'Headers de defensa en profundidad: CSP, X-Frame-Options/frame-ancestors, nosniff, Referrer-Policy, Permissions-Policy, HSTS.',
        method: `Headers reales de la respuesta a ${probe.origin}/saas.`,
      },
      async () => {
        if (!home) return noPages()
        const h = home.response.headers
        const missing: string[] = []
        const findings: string[] = []
        if (h.get('x-content-type-options')?.toLowerCase() !== 'nosniff') missing.push('X-Content-Type-Options: nosniff')
        const csp = h.get('content-security-policy')
        const cspReportOnly = h.get('content-security-policy-report-only')
        if (!h.get('x-frame-options') && !/frame-ancestors/i.test(csp ?? '')) missing.push('X-Frame-Options o CSP frame-ancestors')
        if (!h.get('referrer-policy')) missing.push('Referrer-Policy')
        if (!h.get('permissions-policy')) missing.push('Permissions-Policy')
        if (!h.get('strict-transport-security')) missing.push('Strict-Transport-Security')
        if (!csp && cspReportOnly) findings.push('La CSP está en modo Report-Only: detecta pero no bloquea.')
        if (!csp && !cspReportOnly) missing.push('Content-Security-Policy')
        if (h.get('x-powered-by')) findings.push(`El servidor expone X-Powered-By: ${h.get('x-powered-by')}`)
        return {
          status: missing.length > 0 ? 'warning' : findings.length > 0 ? 'warning' : 'healthy',
          severity: missing.length > 0 ? 'medium' : 'low',
          summary: missing.length > 0 ? `Faltan ${missing.length} header(s)` : findings.length ? 'Headers presentes; CSP sin aplicar' : 'Todos los headers presentes',
          findings: [...missing.map((m) => `Falta ${m}`), ...findings],
          recommendation: 'Revisar next.config.ts → headers(). Pasar la CSP a modo enforce cuando el reporte no muestre bloqueos legítimos.',
        }
      },
    ),
    runCheck(
      {
        id: 'security.secrets',
        category: 'security',
        name: 'Secretos y variables sensibles',
        description: 'Ningún secreto de servidor debe tener prefijo NEXT_PUBLIC_, leerse desde un Client Component ni aparecer en HTML/JS público.',
        method: `Nombres de variables del proceso; ${codeAuditMethod()} Búsqueda de los valores privados en el HTML de /saas y en sus scripts del mismo origen (la comparación ocurre en el servidor).`,
      },
      async () => {
        const findings: string[] = []
        const publicSecretNames = Object.keys(process.env).filter(
          (key) => key.startsWith('NEXT_PUBLIC_') && /SECRET|PRIVATE|SERVICE_ROLE|PASSWORD|_TOKEN$/i.test(key),
        )
        publicSecretNames.forEach((key) => findings.push(`${key} tiene prefijo NEXT_PUBLIC_ y se incluye en el bundle del navegador.`))
        codeAudit.clientPrivateEnvRefs.forEach((ref) => findings.push(`${ref.file} ('use client') lee ${ref.vars.join(', ')}.`))

        const secrets = PRIVATE_KEYS.map((key) => ({ key, value: process.env[key]?.trim() ?? '' })).filter((s) => s.value.length >= 12)
        let scanned = 0
        const leaked = new Set<string>()
        if (home) {
          const bodies: string[] = [home.response.body]
          const scripts = home.html.scripts
            .map((src) => new URL(src, probe.origin))
            .filter((url) => url.origin === probe.origin)
            .slice(0, 15)
          const fetched = await Promise.all(scripts.map((url) => probe.get(`${url.pathname}${url.search}`)))
          bodies.push(...fetched.filter((r) => r.ok).map((r) => r.body))
          scanned = bodies.length
          for (const body of bodies) {
            for (const secret of secrets) if (body.includes(secret.value)) leaked.add(secret.key)
          }
        }
        leaked.forEach((key) => findings.unshift(`El valor de ${key} aparece en HTML/JS público.`))

        return {
          status: leaked.size > 0 || publicSecretNames.length > 0 ? 'error' : findings.length > 0 ? 'warning' : 'healthy',
          severity: leaked.size > 0 || publicSecretNames.length > 0 ? 'critical' : 'medium',
          summary: leaked.size > 0
            ? `${leaked.size} secreto(s) expuesto(s) al navegador`
            : `Sin secretos detectados en ${scanned} archivo(s) públicos; ${secrets.length} valores comparados`,
          findings,
          recommendation: leaked.size > 0 || publicSecretNames.length > 0
            ? 'Rotar inmediatamente el secreto expuesto en su proveedor y quitar el prefijo NEXT_PUBLIC_.'
            : undefined,
          metadata: { scannedFiles: scanned, comparedSecrets: secrets.length },
        }
      },
    ),
    runCheck(
      {
        id: 'security.superadmin_protection',
        category: 'auth',
        name: 'Protección de /superadmin',
        description: '/superadmin/* y /api/superadmin/* no deben responder a visitantes ni a usuarios de organizaciones cliente.',
        method: `GET sin sesión a ${probe.origin}/superadmin/system-health y /api/superadmin/notifications (sin seguir redirecciones). ${codeAuditMethod()}`,
      },
      async () => {
        const findings: string[] = []
        let critical = false
        let uncertain = false
        const page = await probe.get('/superadmin/system-health', { redirect: 'manual', readBody: false })
        if (page.status === 200) {
          critical = true
          findings.push('/superadmin/system-health respondió 200 a un visitante sin sesión.')
        } else if (isExpectedProtectedResponse(page)) {
          findings.push(`/superadmin/system-health → ${page.status}${page.redirectLocation ? ` a ${new URL(page.redirectLocation, probe.origin).pathname}` : ''} (correcto)`)
        } else {
          uncertain = true
          findings.push(`/superadmin/system-health no permitió confirmar la protección: ${describeStatus(page)}`)
        }
        const api = await probe.get('/api/superadmin/notifications', { redirect: 'manual', readBody: false })
        if (api.status >= 200 && api.status < 300) {
          critical = true
          findings.push(`/api/superadmin/notifications respondió ${api.status} sin sesión.`)
        } else if (isExpectedProtectedResponse(api)) {
          findings.push(`/api/superadmin/notifications → ${api.status} (correcto)`)
        } else {
          uncertain = true
          findings.push(`/api/superadmin/notifications no permitió confirmar la protección: ${describeStatus(api)}`)
        }
        const unguarded = codeAudit.apiRoutes.filter((r) => r.route.startsWith('/api/superadmin/') && !r.superAdminGuard)
        unguarded.forEach((r) => findings.push(`${r.route} no llama a getSuperAdminUser/requireSuperAdmin/withSuperAdminAuth.`))
        if (!codeAudit.superAdminLayoutGuarded) findings.push('src/app/superadmin/layout.tsx no valida SuperAdmin.')
        findings.push('La autorización se valida en servidor: proxy.ts (user_roles), layout (requireSuperAdmin) y cada acción/API.')

        const codeGuarded = unguarded.length === 0 && codeAudit.superAdminLayoutGuarded
        const ok = !critical && !uncertain && codeGuarded
        return {
          status: critical || !codeGuarded ? 'error' : uncertain ? 'unknown' : 'healthy',
          severity: critical ? 'critical' : 'high',
          summary: critical
            ? 'Rutas de SuperAdmin accesibles sin sesión'
            : !codeGuarded
              ? 'Faltan guardias en el código'
              : uncertain
                ? 'Guardias presentes; la respuesta HTTP no confirmó el bloqueo'
                : 'Bloqueado para visitantes; guardias presentes en código',
          findings,
          recommendation: ok ? 'Probar también con un usuario de una organización cliente (no se automatiza para no usar credenciales reales).' : 'Agregar getSuperAdminUser() al inicio de cada handler de /api/superadmin.',
        }
      },
    ),
    runCheck(
      {
        id: 'security.admin_api_guards',
        category: 'security',
        name: 'Guardias en APIs administrativas',
        description: 'Cada handler de /api/admin y /api/superadmin debe validar sesión y permisos.',
        method: codeAuditMethod(),
      },
      async () => {
        const unguarded = codeAudit.apiRoutes.filter((r) => /^\/api\/(admin|superadmin)\//.test(r.route) && !r.authGuard)
        const selfPromotion = process.env.ALLOW_ADMIN_SELF_PROMOTION === 'true'
        const findings = unguarded.map((r) => `${r.route} (${r.methods.join(', ')}): no se detectó validación de sesión/permiso.`)
        if (selfPromotion) findings.unshift('ALLOW_ADMIN_SELF_PROMOTION=true habilita /api/admin/promote-self.')
        return {
          status: findings.length > 0 ? 'error' : 'healthy',
          severity: 'high',
          summary: findings.length > 0
            ? `${findings.length} hallazgo(s)`
            : `${codeAudit.apiRoutes.filter((r) => /^\/api\/(admin|superadmin)\//.test(r.route)).length} rutas administrativas con guardia detectada`,
          findings,
          recommendation: findings.length > 0 ? 'Usar withAdminAuth/withSuperAdminAuth en cada handler. Desactivar ALLOW_ADMIN_SELF_PROMOTION fuera de la instalación inicial.' : undefined,
        }
      },
    ),
    runCheck(
      {
        id: 'security.rate_limiting',
        category: 'security',
        name: 'Rate limiting',
        description: 'Endpoints públicos que escriben deben tener límite de solicitudes compartido entre instancias (Upstash). El login y la recuperación de contraseña los limita Supabase Auth.',
        method: `Variables UPSTASH_* configuradas; ${codeAuditMethod()}`,
      },
      async () => {
        const upstash = isConfigured('UPSTASH_REDIS_REST_URL') && isConfigured('UPSTASH_REDIS_REST_TOKEN')
        const publicWrites = codeAudit.apiRoutes
          .flatMap(mutatingOperations)
          .filter((operation) => !operation.authGuard || /^\/api\/(public|auth)\//.test(operation.route))
        const unprotected = publicWrites.filter((r) => !r.rateLimited)
        const anonymousUnprotected = unprotected.filter((r) => !r.authGuard)
        const findings: string[] = []
        if (!upstash) findings.push('UPSTASH_REDIS_REST_URL/TOKEN no configuradas: el limitador usa memoria por instancia y en Vercel no es efectivo.')
        anonymousUnprotected.forEach((r) => findings.push(`${r.route} (${r.method}) acepta escrituras sin sesión y sin rate limit.`))
        unprotected.filter((r) => r.authGuard).forEach((r) => findings.push(`${r.route} (${r.method}): requiere sesión pero no tiene rate limit (prioridad baja).`))
        findings.push('Login, registro de usuario y recuperación de contraseña: límites de Supabase Auth (verificar en Dashboard → Auth → Rate Limits; no hay API configurada para leerlos).')
        return {
          status: !upstash || anonymousUnprotected.length > 0 ? 'warning' : 'healthy',
          severity: 'medium',
          summary: `${publicWrites.length - unprotected.length}/${publicWrites.length} operaciones públicas de escritura con rate limit${upstash ? ' (Upstash)' : ' (sin Upstash)'}`,
          findings,
          recommendation: 'Aplicar rateLimiter (src/lib/rate-limiter.ts) a los endpoints listados, especialmente los que aceptan escrituras sin sesión.',
        }
      },
    ),
    runCheck(
      {
        id: 'security.turnstile',
        category: 'security',
        name: 'Turnstile / anti-bots',
        description: 'Cloudflare Turnstile protege formularios públicos. Sin TURNSTILE_SECRET_KEY en producción, verifyTurnstileToken() rechaza todo (reason: not_configured).',
        method: `Presencia de NEXT_PUBLIC_TURNSTILE_SITE_KEY y TURNSTILE_SECRET_KEY (sin leer valores). ${codeAuditMethod()}`,
      },
      async () => {
        const siteKey = isConfigured('NEXT_PUBLIC_TURNSTILE_SITE_KEY')
        const secret = isConfigured('TURNSTILE_SECRET_KEY')
        const protectedRoutes = codeAudit.apiRoutes
          .flatMap((route) => route.methodSecurity?.map((method) => ({ route: route.route, ...method })) ?? [])
          .filter((operation) => operation.turnstile)
          .map((operation) => `${operation.route} (${operation.method})`)
        const findings = [
          `Site key: ${siteKey ? 'configurada' : 'faltante'} · Secret: ${secret ? 'configurado' : 'faltante'}`,
          protectedRoutes.length ? `Verifican token: ${protectedRoutes.join(', ')}` : 'Ningún endpoint verifica tokens de Turnstile.',
        ]
        if (siteKey && !secret) findings.push('Con site key pero sin secret, los formularios que exigen Turnstile fallan en producción.')
        const configured = siteKey && secret
        return {
          status: !siteKey && !secret ? 'not_configured' : configured ? 'healthy' : 'error',
          severity: 'medium',
          summary: configured ? `Configurado; ${protectedRoutes.length} endpoint(s) lo verifican` : siteKey ? 'Configuración incompleta' : 'No configurado',
          findings,
          recommendation: configured ? undefined : 'Definir TURNSTILE_SECRET_KEY en Vercel (Production) junto con NEXT_PUBLIC_TURNSTILE_SITE_KEY.',
        }
      },
    ),
    runCheck(
      {
        id: 'security.spam',
        category: 'security',
        name: 'Protección contra spam',
        description: 'Cada endpoint que acepta escrituras sin sesión debería tener rate limit o Turnstile.',
        method: codeAuditMethod(),
      },
      async () => {
        const anonymousWrites = codeAudit.apiRoutes.flatMap(mutatingOperations).filter((operation) => !operation.authGuard)
        const exposed = anonymousWrites.filter((r) => !r.rateLimited && !r.turnstile)
        return {
          status: exposed.length > 0 ? 'warning' : 'healthy',
          severity: 'medium',
          summary: `${anonymousWrites.length - exposed.length}/${anonymousWrites.length} operaciones anónimas de escritura protegidas`,
          findings: [
            ...exposed.map((r) => `${r.route} (${r.method}) sin rate limit ni Turnstile`),
            ...anonymousWrites.filter((r) => r.rateLimited && !r.turnstile).map((r) => `${r.route} (${r.method}): solo rate limit`),
          ],
          recommendation: exposed.length > 0 ? 'Agregar rateLimiter y, en formularios visibles (registro, reseñas, pedidos), Turnstile.' : undefined,
        }
      },
    ),
    runCheck(
      {
        id: 'security.public_files',
        category: 'security',
        name: 'Archivos de datos públicos',
        description: 'Todo lo que está en public/ se sirve sin autenticación. CSV/XLSX/SQL no deberían estar ahí.',
        method: `${codeAuditMethod()} GET real a cada archivo en ${probe.origin}.`,
      },
      async () => {
        const files = codeAudit.publicSensitiveFiles
        if (files.length === 0) return { status: 'healthy', severity: 'high', summary: 'No hay archivos de datos en public/' }
        const results = await Promise.all(files.map(async (file) => ({ file, response: await probe.get(file, { readBody: false }) })))
        const served = results.filter((r) => r.response.ok)
        return {
          status: served.length > 0 ? 'error' : 'warning',
          severity: 'high',
          summary: served.length > 0 ? `${served.length} archivo(s) de datos descargables públicamente` : `${files.length} archivo(s) en public/ (no respondieron en producción)`,
          findings: results.map((r) => `${r.file} → ${r.response.status || r.response.error}`),
          recommendation: 'Mover los archivos fuera de public/ (por ejemplo a un bucket privado) y eliminarlos del deploy.',
        }
      },
    ),

    // ------------------------------------------------------------------ Legal
    ...(['privacy', 'terms'] as const).map((kind) =>
      runCheck(
        {
          id: `legal.${kind}`,
          category: 'legal',
          name: kind === 'privacy' ? 'Política de privacidad' : 'Términos y condiciones',
          description: kind === 'privacy'
            ? 'Página pública que explique qué datos personales se tratan (Ley 6534/20 de Paraguay y normas de tiendas online).'
            : 'Condiciones de uso del SaaS y del marketplace.',
          method: `${codeAuditMethod()} GET a rutas habituales y búsqueda de enlaces en /saas.`,
        },
        async () => {
          const pattern = kind === 'privacy' ? /privacidad|privacy/i : /t[eé]rminos|terms|condiciones/i
          const implemented = codeAudit.legalPages.some((path) => pattern.test(path))
          const linked = (home?.html.links ?? []).filter((l) => pattern.test(l.href) || pattern.test(l.text)).map((l) => l.href)
          const candidates = [...new Set([...codeAudit.legalPages.filter((p) => pattern.test(p)), ...LEGAL_CANDIDATES[kind], ...linked.filter((h) => h.startsWith('/'))])]
          const responses = await Promise.all(candidates.map(async (path) => ({ path, response: await probe.get(path, { readBody: false }) })))
          const found = responses.find((r) => r.response.ok)
          return {
            status: found ? (linked.length ? 'healthy' : 'warning') : implemented ? 'warning' : 'error',
            severity: 'medium',
            summary: found ? `Encontrada en ${found.path}` : implemented ? 'Implementada, sin versión publicada' : 'No existe',
            findings: found
              ? linked.length ? [] : ['La página existe pero /saas no la enlaza.']
              : implemented
                ? [`La ruta está en el código, pero ninguna versión publicada respondió 200: ${candidates.join(', ')}`]
                : [`Ninguna ruta respondió 200: ${candidates.join(', ')}`],
            recommendation: found
              ? undefined
              : implemented
                ? 'Completar y publicar el borrador desde Superadmin → Contenido web → Documentos legales.'
                : `Crear la página (p. ej. src/app/saas/${kind === 'privacy' ? 'privacidad' : 'terminos'}/page.tsx) y enlazarla en el footer y en el registro.`,
          }
        },
      ),
    ),
    runCheck(
      {
        id: 'legal.cookies',
        category: 'legal',
        name: 'Aviso de cookies',
        description: 'El sitio usa cookies de sesión y analítica propia (site_analytics_events). Se recomienda informar y permitir rechazar la analítica.',
        method: `${codeAuditMethod()} Búsqueda de un componente de consentimiento y del texto "cookies" en el HTML de /saas.`,
      },
      async () => {
        const inCode = codeAudit.cookieConsentFiles
        const inHtml = home ? /cookie/i.test(home.response.body.replace(/<script[\s\S]*?<\/script>/gi, '')) : false
        return {
          status: inCode.length > 0 ? 'healthy' : inHtml ? 'warning' : 'error',
          severity: 'medium',
          summary: inCode.length > 0 ? 'Componente de consentimiento detectado' : inHtml ? 'Se menciona "cookies" pero no hay componente de consentimiento' : 'No se detectó aviso de cookies',
          findings: inCode,
          recommendation: inCode.length > 0 ? undefined : 'Agregar un banner con opción de rechazar analítica y condicionar el tracking de site-analytics a esa elección.',
        }
      },
    ),

    // ------------------------------------------------------------------ SEO
    runCheck(
      { id: 'seo.meta_description', category: 'seo', name: 'Meta descriptions', description: 'Cada página pública indexable necesita <meta name="description"> propia.', method: htmlMethod },
      async () => {
        if (reachable.length === 0) return noPages()
        const missing = reachable.filter((p) => !p.html.metaDescription?.trim())
        const short = reachable.filter((p) => p.html.metaDescription && p.html.metaDescription.length < 50)
        const descriptions = reachable.map((p) => p.html.metaDescription).filter(Boolean)
        const duplicated = descriptions.length - new Set(descriptions).size
        const findings = [
          ...missing.map((p) => `Falta meta description en ${p.path}`),
          ...short.map((p) => `Meta description corta (${p.html.metaDescription?.length} caracteres) en ${p.path}`),
          ...(duplicated > 0 ? [`${duplicated} página(s) repiten la misma description`] : []),
          ...unreachable(pages),
        ]
        const unreachableFailures = pages.filter((page) => !page.html && !page.response.challenged)
        return {
          status: missing.length > 0 ? 'error' : unreachableFailures.length > 0 ? 'unknown' : 'healthy',
          severity: 'low',
          summary: missing.length > 0
            ? `${missing.length} página(s) sin meta description`
            : `${reachable.length} páginas verificables con description${pages.some((page) => page.response.challenged) ? '; las protegidas por Cloudflare se omiten' : ''}`,
          findings,
          recommendation: findings.length ? 'Definir `metadata.description` (o generateMetadata) en cada page.tsx pública.' : undefined,
        }
      },
    ),
    runCheck(
      { id: 'seo.favicon', category: 'seo', name: 'Favicon', description: 'Ícono declarado en el HTML y accesible.', method: `${htmlMethod} GET al primer ícono declarado.` },
      async () => {
        if (!home) return noPages()
        const href = home.html.icons[0] ?? '/favicon.ico'
        const url = new URL(href, probe.origin)
        const response = url.origin === probe.origin ? await probe.get(`${url.pathname}${url.search}`, { readBody: false }) : await probe.head(url.toString())
        return {
          status: home.html.icons.length && response.ok ? 'healthy' : response.ok ? 'warning' : 'error',
          severity: 'low',
          summary: response.ok ? `${url.pathname} responde ${response.status}` : `${url.pathname} no responde (${response.status || response.error})`,
          findings: home.html.icons.length ? [] : ['No hay <link rel="icon"> en /saas; se probó /favicon.ico.'],
        }
      },
    ),
    runCheck(
      { id: 'seo.sitemap', category: 'seo', name: 'Sitemap', description: 'sitemap.xml accesible y con URLs del dominio canónico.', method: `GET ${probe.origin}/sitemap.xml` },
      async () => {
        const response = await probe.get('/sitemap.xml')
        if (!response.ok) return { status: probeFailureStatus(response), severity: 'low', summary: `sitemap.xml respondió ${response.status || response.error}` }
        const locs = [...response.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1])
        const foreign = locs.filter((loc) => {
          try {
            return new URL(loc).host !== new URL(probe.origin).host
          } catch {
            return true
          }
        })
        const localhost = foreign.filter((loc) => /localhost|127\.0\.0\.1/.test(loc))
        return {
          status: localhost.length > 0 ? 'error' : foreign.length > 0 || locs.length === 0 ? 'warning' : 'healthy',
          severity: 'low',
          summary: `${locs.length} URLs${foreign.length ? `, ${foreign.length} de otro host` : ''}`,
          findings: [...new Set(foreign.map((loc) => new URL(loc, probe.origin).origin))].map((o) => `URLs con host ${o} (esperado ${probe.origin})`),
          recommendation: foreign.length ? 'Definir NEXT_PUBLIC_SITE_URL con el dominio canónico en Vercel Production y volver a desplegar.' : undefined,
        }
      },
    ),
    runCheck(
      { id: 'seo.robots', category: 'seo', name: 'robots.txt', description: 'robots.txt accesible, con Sitemap y bloqueando zonas privadas.', method: `GET ${probe.origin}/robots.txt` },
      async () => {
        const response = await probe.get('/robots.txt')
        if (!response.ok) return { status: probeFailureStatus(response), severity: 'low', summary: `robots.txt respondió ${response.status || response.error}` }
        const body = response.body
        const findings: string[] = []
        const sitemapLine = body.match(/^sitemap:\s*(\S+)/im)?.[1]
        if (!sitemapLine) findings.push('No declara Sitemap:')
        else if (!sitemapLine.startsWith(probe.origin)) findings.push(`Sitemap apunta a ${sitemapLine}`)
        for (const path of ['/dashboard', '/superadmin', '/api/']) {
          if (!new RegExp(`^disallow:\\s*${path.replace('/', '\\/')}`, 'im').test(body)) findings.push(`No bloquea ${path}`)
        }
        return {
          status: findings.length > 0 ? 'warning' : 'healthy',
          severity: 'low',
          summary: findings.length > 0 ? `${findings.length} observación(es)` : 'Correcto',
          findings,
          recommendation: findings.length ? 'Ajustar src/app/robots.ts (las páginas de /superadmin ya envían noindex).' : undefined,
        }
      },
    ),
    runCheck(
      { id: 'seo.open_graph', category: 'seo', name: 'Open Graph / preview social', description: 'og:title, og:description y og:image accesible para previews en WhatsApp/redes.', method: `${htmlMethod} HEAD a og:image.` },
      async () => {
        if (reachable.length === 0) return noPages()
        const findings: string[] = []
        for (const page of reachable) {
          const missing = ['og:title', 'og:description', 'og:image'].filter((k) => !page.html.og[k])
          if (missing.length) findings.push(`Falta ${missing.join(', ')} en ${page.path}`)
        }
        const image = home?.html.og['og:image']
        if (image) {
          const response = await probe.head(image)
          if (!response.ok && response.error !== 'Host externo omitido') findings.push(`og:image de /saas no responde (${response.status || response.error})`)
        }
        return {
          status: findings.length === 0 ? 'healthy' : findings.length >= reachable.length ? 'error' : 'warning',
          severity: 'low',
          summary: findings.length === 0 ? 'Open Graph completo' : `${findings.length} observación(es)`,
          findings,
          recommendation: findings.length ? 'Definir metadata.openGraph (y una opengraph-image) en el layout de /saas y en cada página pública.' : undefined,
        }
      },
    ),
    runCheck(
      { id: 'seo.image_alt', category: 'seo', name: 'ALT de imágenes', description: 'Las imágenes con contenido necesitan texto alternativo (alt="" solo para decorativas).', method: htmlMethod },
      async () => {
        if (reachable.length === 0) return noPages()
        const findings: string[] = []
        let total = 0
        for (const page of reachable) {
          total += page.html.images.length
          const missing = page.html.images.filter((img) => img.alt === null)
          if (missing.length) findings.push(`${missing.length} imagen(es) sin alt en ${page.path}`)
        }
        return {
          status: findings.length ? 'warning' : 'healthy',
          severity: 'low',
          summary: findings.length ? `${findings.length} página(s) con imágenes sin alt` : `${total} imágenes con alt`,
          findings,
        }
      },
    ),

    // ------------------------------------------------------------------ UX
    runCheck(
      { id: 'ux.mobile', category: 'ux', name: 'Funcionamiento móvil', description: 'Meta viewport correcto en cada página pública. No reemplaza una prueba en dispositivo real.', method: htmlMethod },
      async () => {
        if (reachable.length === 0) return noPages()
        const missing = reachable.filter((p) => !/width=device-width/i.test(p.html.viewport ?? ''))
        const blocksZoom = reachable.filter((p) => /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(p.html.viewport ?? ''))
        return {
          status: missing.length ? 'error' : blocksZoom.length ? 'warning' : 'healthy',
          severity: 'medium',
          summary: missing.length ? `${missing.length} página(s) sin viewport móvil` : 'Viewport móvil en todas las páginas',
          findings: [
            ...missing.map((p) => `Sin width=device-width en ${p.path}`),
            ...blocksZoom.map((p) => `${p.path} impide hacer zoom (accesibilidad)`),
          ],
        }
      },
    ),
    runCheck(
      { id: 'ux.not_found', category: 'ux', name: 'Página 404', description: 'Una ruta inexistente debe responder 404 (no 200 ni 500).', method: `GET a una ruta aleatoria en ${probe.origin}.` },
      async () => {
        const response = await probe.get(`/__system-health-${randomUUID().slice(0, 8)}`, { readBody: true })
        const hasBody = response.body.length > 200
        return {
          status: response.status === 404 && hasBody
            ? 'healthy'
            : response.status === 404
              ? 'warning'
              : probeFailureStatus(response),
          severity: 'medium',
          summary: `Respondió ${response.status || response.error}`,
          findings: [
            ...(response.status !== 404 ? [`Se esperaba 404 y se obtuvo ${response.status}`] : []),
            ...(codeAudit.errorBoundaries.some((f) => f.endsWith('not-found.tsx')) ? [] : ['No hay src/app/not-found.tsx: se usa la página 404 por defecto de Next.js.']),
          ],
          recommendation: codeAudit.errorBoundaries.some((f) => f.endsWith('not-found.tsx')) ? undefined : 'Crear src/app/not-found.tsx con navegación de vuelta al sitio.',
        }
      },
    ),
    runCheck(
      { id: 'ux.broken_links', category: 'ux', name: 'Enlaces rotos', description: 'Enlaces internos de las páginas públicas que responden 4xx/5xx.', method: `${htmlMethod} GET a hasta 40 enlaces internos únicos.` },
      async () => {
        if (reachable.length === 0) return noPages()
        const links = new Map<string, string>()
        for (const page of reachable) {
          for (const link of page.html.links) {
            if (!link.href || link.href.startsWith('#') || /^(mailto|tel|javascript|whatsapp):/i.test(link.href)) continue
            try {
              const url = new URL(link.href, `${probe.origin}${page.path}`)
              if (url.origin !== probe.origin) continue
              const key = `${url.pathname}${url.search}`
              if (!links.has(key)) links.set(key, page.path)
            } catch {
              // href inválido: se ignora.
            }
          }
        }
        const targets = [...links.entries()].slice(0, 40)
        const results = await Promise.all(targets.map(async ([path, from]) => ({ path, from, response: await probe.get(path, { readBody: false }) })))
        const broken = results.filter((r) => isHttpFailure(r.response))
        const challenged = results.filter((r) => r.response.challenged)
        return {
          status: broken.length ? 'error' : 'healthy',
          severity: 'medium',
          summary: broken.length
            ? `${broken.length} enlace(s) roto(s) de ${results.length}`
            : `${results.length - challenged.length} enlaces internos responden${challenged.length ? `; ${challenged.length} protegidos por Cloudflare` : ''}`,
          findings: [
            ...broken.map((r) => `${r.path} (desde ${r.from}) → ${r.response.status || r.response.error}`),
            ...challenged.map((r) => `${r.path}: ${describeStatus(r.response)}`),
          ],
        }
      },
    ),
    runCheck(
      { id: 'ux.cta', category: 'ux', name: 'CTA principales', description: 'La landing /saas debe llevar a registrarse y a ver planes.', method: htmlMethod },
      async () => {
        if (!home) return noPages()
        const hrefs = home.html.links.map((l) => l.href)
        const register = hrefs.some((h) => /\/register|\/registro/.test(h))
        const plans = hrefs.some((h) => /\/saas\/planes|#planes/.test(h))
        return {
          status: register && plans ? 'healthy' : 'warning',
          severity: 'low',
          summary: register && plans ? 'Enlaces a registro y planes presentes' : 'Falta algún CTA principal',
          findings: [...(register ? [] : ['No hay enlace a /register en /saas']), ...(plans ? [] : ['No hay enlace a /saas/planes en /saas'])],
        }
      },
    ),
    runCheck(
      { id: 'ux.navigation', category: 'ux', name: 'Navegación', description: 'Estructura semántica (<nav>, <main>, lang) en páginas públicas.', method: htmlMethod },
      async () => {
        if (reachable.length === 0) return noPages()
        const findings = reachable.flatMap((p) => [
          ...(p.html.hasNav ? [] : [`${p.path} sin <nav>`]),
          ...(p.html.hasMain ? [] : [`${p.path} sin <main>`]),
          ...(p.html.lang ? [] : [`${p.path} sin atributo lang`]),
        ])
        return {
          status: findings.length ? 'warning' : 'healthy',
          severity: 'low',
          summary: findings.length ? `${findings.length} observación(es)` : 'Estructura semántica correcta',
          findings,
        }
      },
    ),
    runCheck(
      { id: 'ux.forms', category: 'ux', name: 'Formularios', description: 'Validación, mensajes de error y envío de login, registro, reseñas y pedidos.', method: 'Requiere navegador. Ejecutar npm run audit:browser para la estructura y validación nativa; el envío real necesita staging.' },
      async () => ({
        status: 'unknown',
        severity: 'info',
        summary: 'No verificable automáticamente desde el servidor',
        recommendation: 'Ejecutar npm run audit:browser; completar los envíos de login, registro, reseña y pedido en staging con datos de prueba.',
      }),
    ),
    runCheck(
      { id: 'ux.contrast', category: 'ux', name: 'Contraste', description: 'Relación de contraste WCAG AA (4.5:1 texto normal).', method: 'Requiere renderizar la página. Ejecutar npm run audit:browser (Playwright + axe-core).' },
      async () => ({
        status: 'unknown',
        severity: 'info',
        summary: 'No disponible: requiere auditoría en navegador',
        recommendation: 'Ejecutar npm run audit:browser; el reporte incluye selectores y razones de cada incumplimiento WCAG.',
      }),
    ),

    // ------------------------------------------------------------------ Rendimiento
    runCheck(
      { id: 'performance.response_time', category: 'performance', name: 'Tiempo de respuesta', description: 'Tiempo hasta recibir el HTML completo desde este servidor (no incluye render en el navegador).', method: htmlMethod },
      async () => {
        const measured = pages.filter((p) => p.response.status > 0 && !p.response.challenged)
        const challenged = pages.filter((p) => p.response.challenged)
        if (measured.length === 0) return noPages()
        const slow = measured.filter((p) => p.response.durationMs > 1500)
        const verySlow = measured.filter((p) => p.response.durationMs > 4000)
        const samples = measured.map((page) => page.response.durationMs)
        const avg = Math.round(samples.reduce((sum, duration) => sum + duration, 0) / samples.length)
        const medianMs = median(samples)
        const p95Ms = percentile(samples, 95)
        const maxMs = Math.max(...samples)
        return {
          status: verySlow.length ? 'error' : slow.length ? 'warning' : 'healthy',
          severity: 'low',
          summary: `Promedio ${avg} ms; ${measured.length}/${pages.length} páginas medidas${challenged.length ? `, ${challenged.length} excluida(s) por desafío de Cloudflare` : ''}`,
          findings: [
            ...measured.map((p) => `${p.path}: ${p.response.durationMs} ms (HTTP ${p.response.status})`),
            ...challenged.map((p) => `${p.path}: ${describeStatus(p.response)}`),
          ],
          metadata: {
            averageMs: avg,
            medianMs,
            p95Ms,
            maxMs,
            measuredPages: measured.length,
            totalPages: pages.length,
            excludedByCloudflare: challenged.length,
          },
        }
      },
    ),
    runCheck(
      { id: 'performance.http_errors', category: 'performance', name: 'Errores HTTP', description: 'Páginas públicas que responden 4xx/5xx en esta comprobación.', method: htmlMethod },
      async () => {
        const errors = pages.filter((p) => isHttpFailure(p.response))
        const challenged = pages.filter((p) => p.response.challenged)
        return {
          status: errors.some((p) => p.response.status >= 500 || p.response.status === 0) ? 'error' : errors.length ? 'warning' : 'healthy',
          severity: 'medium',
          summary: errors.length
            ? `${errors.length}/${pages.length} páginas con error`
            : `${pages.length - challenged.length}/${pages.length} páginas OK${challenged.length ? `, ${challenged.length} con desafío de Cloudflare` : ''}`,
          findings: [
            ...errors.map((p) => `${p.path} → ${p.response.status || p.response.error}`),
            ...challenged.map((p) => `${p.path}: ${describeStatus(p.response)}`),
          ],
        }
      },
    ),
    runCheck(
      { id: 'performance.heavy_resources', category: 'performance', name: 'Recursos pesados', description: 'Tamaño de los scripts de /saas y de las imágenes de las páginas públicas.', method: `${htmlMethod} HEAD a scripts e imágenes (Content-Length).` },
      async () => {
        if (!home) return noPages()
        const scripts = home.html.scripts.map((s) => new URL(s, probe.origin).toString())
        const images = [...new Set(reachable.flatMap((p) => p.html.images.map((i) => i.src)).filter(Boolean))].slice(0, 30).map((s) => new URL(s, probe.origin).toString())
        const heads = await Promise.all([...scripts, ...images].map(async (url) => ({ url, response: await probe.head(url) })))
        const sized = heads
          .map((h) => ({ url: h.url, bytes: Number(h.response.headers.get('content-length') ?? NaN) }))
          .filter((h) => Number.isFinite(h.bytes))
        const scriptBytes = sized.filter((h) => scripts.includes(h.url)).reduce((s, h) => s + h.bytes, 0)
        const heavy = sized.filter((h) => h.bytes > 400 * 1024)
        const sizedScripts = sized.filter((h) => scripts.includes(h.url)).length
        const findings = [
          sizedScripts > 0
            ? `JS inicial de /saas: ${(scriptBytes / 1024).toFixed(0)} KB en ${sizedScripts}/${scripts.length} archivos con tamaño informado`
            : `JS inicial de /saas: no disponible (${scripts.length} archivos sin Content-Length; se sirven comprimidos por streaming)`,
          ...heavy.map((h) => `${new URL(h.url).pathname}: ${(h.bytes / 1024).toFixed(0)} KB`),
        ]
        if (sized.length < heads.length) findings.push(`${heads.length - sized.length} recurso(s) sin Content-Length o de host externo.`)
        return {
          status: heavy.length || scriptBytes > 1_000_000 ? 'warning' : 'healthy',
          severity: 'low',
          summary: heavy.length ? `${heavy.length} recurso(s) > 400 KB` : 'Sin recursos pesados detectados',
          findings,
        }
      },
    ),
    runCheck(
      { id: 'performance.images', category: 'performance', name: 'Entrega de imágenes raster', description: 'Tamaño de imágenes raster servidas directamente y disponibilidad real del optimizador de Next/Vercel.', method: `${htmlMethod} HEAD a los originales y a /_next/image con una muestra.` },
      async () => {
        if (reachable.length === 0) return noPages()
        const observed = [...new Set(reachable.flatMap((p) => p.html.images.map((image) => image.src)))]
          .filter((src) => src && !src.startsWith('data:'))
        const optimized = observed.filter((src) => src.includes('/_next/image'))
        const raw = observed.filter(
          (src) => !src.includes('/_next/image') && /\.(png|jpe?g|gif|bmp)(\?|$)/i.test(src),
        )

        if (raw.length === 0) {
          return {
            status: 'healthy',
            severity: 'low',
            summary: 'Imágenes optimizadas, modernas o vectoriales',
            findings: [],
            metadata: {
              optimizedImages: optimized.length,
              directRasterImages: 0,
              heavyImages: 0,
              unverifiableImages: 0,
              optimizerStatus: null,
              optimizerUnavailable: false,
            },
          }
        }

        const directUrls = raw.slice(0, 20).map((src) => new URL(src, probe.origin).toString())
        const directResponses = await Promise.all(directUrls.map(async (url) => ({ url, response: await probe.head(url) })))
        const measuredImages = directResponses
          .map(({ url, response }) => ({ url, response, bytes: Number(response.headers.get('content-length') ?? NaN) }))
        const sized = measuredImages
          .filter(({ bytes }) => Number.isFinite(bytes))
        const heavy = sized.filter(({ bytes }) => bytes > IMAGE_BUDGET_BYTES)
        const optimizerPath = `/_next/image?url=${encodeURIComponent(directUrls[0])}&w=640&q=75`
        const optimizerResponse = await probe.head(new URL(optimizerPath, probe.origin).toString())
        const optimizerUnavailable = isImageOptimizerUnavailable(optimizerResponse)
        const unverifiable = measuredImages.filter(({ response, bytes }) => !response.ok || !Number.isFinite(bytes))

        const summary = heavy.length > 0
          ? `${heavy.length} imagen(es) superan 200 KB`
          : optimizerUnavailable
            ? `${raw.length} imagen(es) directas dentro del presupuesto; optimizador de Vercel no disponible`
            : `${raw.length} imagen(es) raster servidas directamente`

        return {
          status: heavy.length > 0
            ? 'warning'
            : unverifiable.length === directUrls.length
              ? 'unknown'
              : unverifiable.length > 0
                ? 'warning'
              : optimizerUnavailable
                ? 'healthy'
                : 'warning',
          severity: 'low',
          summary,
          findings: [
            ...sized.map(({ url, bytes }) => `${url}: ${(bytes / 1024).toFixed(0)} KB`),
            ...(unverifiable.length > 0 ? [`${unverifiable.length} imagen(es) sin tamaño verificable.`] : []),
            ...(optimizerUnavailable ? [`/_next/image respondió ${optimizerResponse.status}: optimizador de Vercel no disponible.`] : []),
          ],
          recommendation: heavy.length > 0
            ? 'Convertir las imágenes pesadas a WebP antes de subirlas y mantener cada archivo público por debajo de 200 KB.'
            : optimizerUnavailable
              ? undefined
              : 'Usar next/image (AppImage) para servir WebP redimensionado.',
          metadata: {
            directRasterImages: raw.length,
            optimizedImages: optimized.length,
            heavyImages: heavy.length,
            unverifiableImages: unverifiable.length,
            optimizerStatus: optimizerResponse.status,
            optimizerUnavailable,
            withinBudget: heavy.length === 0,
          },
        }
      },
    ),
    runCheck(
      { id: 'performance.production_errors', category: 'performance', name: 'Endpoints con errores (producción)', description: 'Tasa de errores 5xx y endpoints que fallan con tráfico real.', method: 'Requiere logs de producción. No hay integración configurada (Vercel Log Drains, Vercel API o Sentry).' },
      async () => ({
        status: 'unknown',
        severity: 'info',
        summary: 'No disponible',
        findings: ['Integraciones que habilitarían esta métrica: VERCEL_API_TOKEN + VERCEL_PROJECT_ID (API de deployments/logs), o Sentry.'],
        recommendation: 'Configurar Sentry o un Log Drain de Vercel; luego agregar un check en src/lib/health/checks/.',
      }),
    ),
  ])

  const responseMetadata = checks.find((check) => check.id === 'performance.response_time')?.metadata
  const imageMetadata = checks.find((check) => check.id === 'performance.images')?.metadata
  const metrics: HealthMetricGroup[] = [
    {
      id: 'web',
      title: 'Rendimiento web (esta comprobación)',
      metrics: [
        { label: 'Origen auditado', value: probe.origin },
        { label: 'Páginas OK', value: `${reachable.length}/${pages.length}` },
      ],
      rows: pages.map((p) => ({
        label: p.path,
        value: p.response.challenged ? 'desafío Cloudflare' : p.response.status ? `${p.response.durationMs} ms` : 'sin respuesta',
        hint: `HTTP ${p.response.status || '—'}`,
      })),
    },
    {
      id: 'performance',
      title: 'Estadísticas de respuesta',
      metrics: [
        { label: 'Muestras', value: responseMetadata?.measuredPages == null ? null : Number(responseMetadata.measuredPages), unavailableReason: responseMetadata?.measuredPages == null ? 'Sin páginas verificables.' : undefined },
        { label: 'Mediana', value: responseMetadata?.medianMs == null ? null : `${responseMetadata.medianMs} ms`, unavailableReason: responseMetadata?.medianMs == null ? 'Sin muestras verificables.' : undefined },
        { label: 'p95', value: responseMetadata?.p95Ms == null ? null : `${responseMetadata.p95Ms} ms`, unavailableReason: responseMetadata?.p95Ms == null ? 'Sin muestras verificables.' : undefined },
        { label: 'Máximo', value: responseMetadata?.maxMs == null ? null : `${responseMetadata.maxMs} ms`, unavailableReason: responseMetadata?.maxMs == null ? 'Sin muestras verificables.' : undefined },
        { label: 'Promedio', value: responseMetadata?.averageMs == null ? null : `${responseMetadata.averageMs} ms`, unavailableReason: responseMetadata?.averageMs == null ? 'Sin muestras verificables.' : undefined },
      ],
    },
    {
      id: 'images',
      title: 'Entrega de imágenes',
      metrics: [
        { label: 'Optimizadas por Next', value: imageMetadata?.optimizedImages == null ? null : Number(imageMetadata.optimizedImages), unavailableReason: imageMetadata?.optimizedImages == null ? 'Sin páginas verificables.' : undefined },
        { label: 'Raster directas', value: imageMetadata?.directRasterImages == null ? null : Number(imageMetadata.directRasterImages), unavailableReason: imageMetadata?.directRasterImages == null ? 'Sin páginas verificables.' : undefined },
        { label: 'Pesadas (> 200 KB)', value: imageMetadata?.heavyImages == null ? null : Number(imageMetadata.heavyImages), unavailableReason: imageMetadata?.heavyImages == null ? 'Sin páginas verificables.' : undefined },
        { label: 'No verificables', value: imageMetadata?.unverifiableImages == null ? null : Number(imageMetadata.unverifiableImages), unavailableReason: imageMetadata?.unverifiableImages == null ? 'Sin páginas verificables.' : undefined },
        {
          label: 'Optimizador',
          value: !imageMetadata
            ? null
            : imageMetadata.optimizerStatus == null
              ? 'sin muestra necesaria'
            : imageMetadata.optimizerUnavailable
              ? `no disponible (HTTP ${imageMetadata.optimizerStatus})`
              : `disponible (HTTP ${imageMetadata.optimizerStatus})`,
          unavailableReason: !imageMetadata ? 'Sin páginas verificables.' : undefined,
        },
      ],
    },
  ]

  return { checks, metrics }
}

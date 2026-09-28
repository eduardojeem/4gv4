import { afterEach, describe, expect, it } from 'vitest'
import { buildResult, sanitizeMessage, worstStatus } from '@/lib/health/core'
import { evaluateReadiness, READINESS_ITEMS } from '@/lib/health/readiness'
import {
  isChallenged,
  isExpectedProtectedResponse,
  parseHtml,
  probeFailureStatus,
  type ProbeResponse,
} from '@/lib/health/site-probe'
import { webhookErrorCode, webhookOutcome } from '@/lib/health/webhook-log'
import type { HealthCheckResult, HealthStatus } from '@/lib/health/types'

describe('sanitizeMessage', () => {
  const original = process.env.PAGOPAR_PRIVATE_KEY
  afterEach(() => {
    process.env.PAGOPAR_PRIVATE_KEY = original
  })

  it('oculta JWT, bearer tokens, cadenas de conexión y parámetros sensibles', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abcdefghijklmnop'
    const message = `fallo ${jwt} Bearer abc.def-123 postgres://u:p@h:5432/db https://x.test/?apikey=SECRET123&x=1`
    const clean = sanitizeMessage(message)
    expect(clean).not.toContain(jwt)
    expect(clean).not.toContain('abc.def-123')
    expect(clean).not.toContain('u:p@h')
    expect(clean).not.toContain('SECRET123')
    expect(clean).toContain('apikey=[oculto]')
  })

  it('oculta el valor literal de variables privadas', () => {
    process.env.PAGOPAR_PRIVATE_KEY = 'pagopar-private-value-xyz'
    expect(sanitizeMessage('error con pagopar-private-value-xyz')).toBe('error con [oculto]')
  })

  it('buildResult sanea resumen y hallazgos', () => {
    process.env.PAGOPAR_PRIVATE_KEY = 'pagopar-private-value-xyz'
    const result = buildResult(
      { id: 'x', category: 'payments', name: 'x', description: '', method: '' },
      { status: 'error', severity: 'high', summary: 'pagopar-private-value-xyz', findings: ['token=abc'] },
    )
    expect(result.summary).toBe('[oculto]')
    expect(result.findings[0]).toBe('token=[oculto]')
  })

  it('un check sano siempre se reporta como info', () => {
    const result = buildResult(
      { id: 'x', category: 'seo', name: 'x', description: '', method: '' },
      { status: 'healthy', severity: 'critical', summary: 'ok' },
    )
    expect(result.severity).toBe('info')
  })
})

describe('worstStatus', () => {
  it('prioriza error > warning > unknown > not_configured > healthy', () => {
    expect(worstStatus(['healthy', 'unknown', 'warning'])).toBe('warning')
    expect(worstStatus(['healthy', 'not_configured'])).toBe('not_configured')
    expect(worstStatus(['healthy'])).toBe('healthy')
  })
})

function check(id: string, status: HealthStatus): HealthCheckResult {
  return {
    id, status, category: 'seo', name: id, severity: 'info', summary: '', description: '', method: '',
    findings: [], checkedAt: new Date(0).toISOString(),
  }
}

describe('evaluateReadiness', () => {
  it('no aprueba ítems no verificados ni ausentes', () => {
    const { rows, approved, total } = evaluateReadiness([
      check('legal.privacy', 'healthy'),
      check('ux.contrast', 'unknown'),
    ])
    expect(total).toBe(READINESS_ITEMS.length)
    expect(approved).toBe(1)
    expect(rows.find((r) => r.item.id === 'contrast')?.approved).toBe(false)
    expect(rows.find((r) => r.item.id === 'terms')?.status).toBe('unknown')
  })

  it('un ítem con varios checks toma el peor estado', () => {
    const { rows } = evaluateReadiness([check('security.secrets', 'healthy'), check('deployment.env', 'warning')])
    expect(rows.find((r) => r.item.id === 'secrets')?.status).toBe('warning')
  })

  it('los opcionales no configurados no bloquean', () => {
    const { rows } = evaluateReadiness([check('analytics.ga4', 'not_configured')])
    expect(rows.find((r) => r.item.id === 'ga4')?.approved).toBe(true)
  })
})

describe('parseHtml', () => {
  it('extrae metadatos, imágenes, enlaces y scripts', () => {
    const html = `<!doctype html><html lang="es"><head>
      <title>Hola &amp; chau</title>
      <meta name="description" content="Una descripción">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <meta property="og:title" content="OG">
      <link rel="icon" href="/favicon.ico">
      <script src="/_next/static/a.js"></script>
    </head><body><nav></nav><main>
      <img src="/a.png" alt="A"><img src="/b.png"><img src='/c.png' alt="">
      <a href="/saas/planes">Ver <b>planes</b></a>
    </main></body></html>`
    const parsed = parseHtml(html)
    expect(parsed.title).toBe('Hola & chau')
    expect(parsed.metaDescription).toBe('Una descripción')
    expect(parsed.og['og:title']).toBe('OG')
    expect(parsed.icons).toEqual(['/favicon.ico'])
    expect(parsed.images.map((i) => i.alt)).toEqual(['A', null, ''])
    expect(parsed.links).toEqual([{ href: '/saas/planes', text: 'Ver planes' }])
    expect(parsed.scripts).toEqual(['/_next/static/a.js'])
    expect(parsed.lang).toBe('es')
    expect(parsed.hasMain && parsed.hasNav).toBe(true)
  })
})

describe('isChallenged', () => {
  it('reconoce el desafío de Cloudflare y no lo confunde con un 403 común', () => {
    expect(isChallenged(403, new Headers({ 'cf-mitigated': 'challenge' }))).toBe(true)
    expect(isChallenged(403, new Headers())).toBe(false)
    expect(isChallenged(200, new Headers({ 'cf-mitigated': 'challenge' }))).toBe(false)
  })
})

function probeResponse(status: number, redirectLocation: string | null = null): ProbeResponse {
  return {
    url: 'https://example.com/superadmin/system-health',
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    body: '',
    durationMs: 1,
    redirectLocation,
    challenged: false,
  }
}

describe('clasificacion de respuestas de la sonda', () => {
  it('trata los fallos de transporte como no disponibles, no como errores del sitio', () => {
    expect(probeFailureStatus(probeResponse(0))).toBe('unknown')
    expect(probeFailureStatus({ ...probeResponse(403), challenged: true })).toBe('unknown')
    expect(probeFailureStatus(probeResponse(500))).toBe('error')
  })

  it('solo confirma la proteccion con 401/403 o una redireccion de autenticacion', () => {
    expect(isExpectedProtectedResponse(probeResponse(401))).toBe(true)
    expect(isExpectedProtectedResponse(probeResponse(403))).toBe(true)
    expect(isExpectedProtectedResponse(probeResponse(302, '/login?next=%2Fsuperadmin'))).toBe(true)
    expect(isExpectedProtectedResponse(probeResponse(404))).toBe(false)
    expect(isExpectedProtectedResponse(probeResponse(500))).toBe(false)
    expect(isExpectedProtectedResponse(probeResponse(302, '/saas'))).toBe(false)
  })
})

describe('webhook log helpers', () => {
  it('traduce respuestas del webhook a resultados y códigos cortos', () => {
    expect(webhookOutcome(200)).toBe('processed')
    expect(webhookOutcome(403)).toBe('rejected')
    expect(webhookOutcome(500)).toBe('error')
    expect(webhookErrorCode(200, null)).toBeNull()
    expect(webhookErrorCode(403, 'Invalid token')).toBe('invalid_token')
    expect(webhookErrorCode(404, 'Payment not found')).toBe('payment_not_found')
    expect(webhookErrorCode(500, 'duplicate key value violates constraint')).toBe('processing_error')
  })
})

import { getSiteUrl } from '@/lib/site-url'
import { errorMessage } from '@/lib/health/core'
import type { HealthStatus } from '@/lib/health/types'

/**
 * Sonda HTTP de solo lectura contra el sitio público.
 *
 * - Solo GET/HEAD, sin cookies ni credenciales: ve lo mismo que un visitante
 *   anónimo (así se comprueba que /superadmin no responde a usuarios sin sesión).
 * - Solo el origen canónico (NEXT_PUBLIC_SITE_URL) y el host de Supabase para
 *   recursos: no acepta URLs arbitrarias, así que no sirve como proxy SSRF.
 * - Memoiza por ruta: varios checks reutilizan la misma respuesta.
 */

export interface ProbeResponse {
  url: string
  ok: boolean
  status: number
  headers: Headers
  body: string
  durationMs: number
  redirectLocation: string | null
  /** Cloudflare respondió con un desafío (bot fight / regla WAF): el contenido no es verificable. */
  challenged: boolean
  error?: string
}

export function isChallenged(status: number, headers: Headers): boolean {
  return status === 403 && (headers.get('cf-mitigated') ?? '').toLowerCase() === 'challenge'
}

/**
 * Un fallo de transporte o un challenge no demuestra que el sitio esté roto.
 * Los HTTP reales 4xx/5xx sí son errores verificables del recurso solicitado.
 */
export function probeFailureStatus(response: ProbeResponse): Extract<HealthStatus, 'unknown' | 'error'> {
  return response.status === 0 || response.challenged ? 'unknown' : 'error'
}

/** Solo confirma protección con rechazo de auth o redirección al acceso. */
export function isExpectedProtectedResponse(response: ProbeResponse): boolean {
  if (response.status === 401 || response.status === 403) return true
  if (response.status < 300 || response.status >= 400 || !response.redirectLocation) return false
  try {
    const pathname = new URL(response.redirectLocation, response.url).pathname
    return /^\/(login|auth)(\/|$)/.test(pathname)
  } catch {
    return false
  }
}

const HTML_LIMIT = 1_500_000
const DEFAULT_TIMEOUT = 8_000

export interface SiteProbe {
  origin: string
  get(path: string, options?: { redirect?: RequestRedirect; readBody?: boolean }): Promise<ProbeResponse>
  head(url: string): Promise<ProbeResponse>
  allowedHosts: Set<string>
}

export function resolveProbeOrigin(): string {
  return getSiteUrl()
}

export function createSiteProbe(origin = resolveProbeOrigin()): SiteProbe {
  const base = new URL(origin)
  const allowedHosts = new Set<string>([base.host])
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl) {
    try {
      allowedHosts.add(new URL(supabaseUrl).host)
    } catch {
      // URL inválida: el check de deployment lo reporta.
    }
  }

  const cache = new Map<string, Promise<ProbeResponse>>()

  async function request(url: URL, method: 'GET' | 'HEAD', redirect: RequestRedirect, readBody: boolean) {
    const start = Date.now()
    try {
      const response = await fetch(url, {
        method,
        redirect,
        cache: 'no-store',
        headers: { 'User-Agent': 'MiTiendaPy-SystemHealth/1.0', Accept: method === 'GET' ? 'text/html,*/*' : '*/*' },
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
      })
      let body = ''
      if (readBody && method === 'GET') {
        const text = await response.text()
        body = text.length > HTML_LIMIT ? text.slice(0, HTML_LIMIT) : text
      } else {
        await response.body?.cancel().catch(() => undefined)
      }
      return {
        url: url.toString(),
        ok: response.ok,
        status: response.status,
        headers: response.headers,
        body,
        durationMs: Date.now() - start,
        redirectLocation: response.headers.get('location'),
        challenged: isChallenged(response.status, response.headers),
      } satisfies ProbeResponse
    } catch (error) {
      return {
        url: url.toString(),
        ok: false,
        status: 0,
        headers: new Headers(),
        body: '',
        durationMs: Date.now() - start,
        redirectLocation: null,
        challenged: false,
        error: errorMessage(error),
      } satisfies ProbeResponse
    }
  }

  return {
    origin: base.origin,
    allowedHosts,
    get(path, options = {}) {
      if (!path.startsWith('/')) throw new Error('La sonda solo acepta rutas relativas al sitio')
      const redirect = options.redirect ?? 'follow'
      const readBody = options.readBody ?? true
      const key = `${redirect}:${readBody}:${path}`
      let pending = cache.get(key)
      if (!pending) {
        pending = request(new URL(path, base), 'GET', redirect, readBody)
        cache.set(key, pending)
      }
      return pending
    },
    head(raw) {
      const url = new URL(raw, base)
      if (!allowedHosts.has(url.host)) {
        return Promise.resolve({
          url: url.toString(), ok: false, status: 0, headers: new Headers(), body: '',
          durationMs: 0, redirectLocation: null, challenged: false, error: 'Host externo omitido',
        })
      }
      const key = `HEAD:${url}`
      let pending = cache.get(key)
      if (!pending) {
        pending = request(url, 'HEAD', 'follow', false)
        cache.set(key, pending)
      }
      return pending
    },
  }
}

// ---------------------------------------------------------------------------
// Parser HTML mínimo (regex). Suficiente para metadatos del <head>, imágenes y
// enlaces del HTML que devuelve el servidor; no ve contenido renderizado solo
// en el cliente, y los checks lo dicen en su descripción.
// ---------------------------------------------------------------------------

export interface ParsedHtml {
  title: string | null
  metaDescription: string | null
  viewport: string | null
  og: Record<string, string>
  icons: string[]
  images: Array<{ src: string; alt: string | null }>
  links: Array<{ href: string; text: string }>
  scripts: string[]
  lang: string | null
  hasMain: boolean
  hasNav: boolean
}

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  if (!match) return null
  return decodeEntities(match[2] ?? match[3] ?? match[4] ?? '')
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

export function parseHtml(html: string): ParsedHtml {
  const metas = html.match(/<meta\b[^>]*>/gi) ?? []
  const og: Record<string, string> = {}
  let metaDescription: string | null = null
  let viewport: string | null = null
  for (const tag of metas) {
    const name = attr(tag, 'name')?.toLowerCase()
    const property = attr(tag, 'property')?.toLowerCase()
    const content = attr(tag, 'content')
    if (content == null) continue
    if (name === 'description') metaDescription = content
    if (name === 'viewport') viewport = content
    if (property?.startsWith('og:')) og[property] = content
    if (name?.startsWith('twitter:')) og[name] = content
  }

  const icons = (html.match(/<link\b[^>]*>/gi) ?? [])
    .filter((tag) => /rel\s*=\s*["']?[^"'>]*icon/i.test(tag))
    .map((tag) => attr(tag, 'href'))
    .filter((href): href is string => Boolean(href))

  const images = (html.match(/<img\b[^>]*>/gi) ?? []).map((tag) => ({
    src: attr(tag, 'src') ?? '',
    alt: attr(tag, 'alt'),
  }))

  const links = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map((match) => ({
    href: attr(` ${match[1]}`, 'href') ?? '',
    text: match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80),
  }))

  const scripts = (html.match(/<script\b[^>]*\ssrc=[^>]*>/gi) ?? [])
    .map((tag) => attr(tag, 'src'))
    .filter((src): src is string => Boolean(src))

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? ''

  return {
    title: titleMatch ? decodeEntities(titleMatch[1].trim()) : null,
    metaDescription,
    viewport,
    og,
    icons,
    images,
    links,
    scripts,
    lang: attr(htmlTag, 'lang'),
    hasMain: /<main\b/i.test(html),
    hasNav: /<nav\b/i.test(html),
  }
}

/** Rutas públicas que se auditan (SEO, rendimiento, UX). */
export const PUBLIC_PAGES = ['/saas', '/saas/planes', '/saas/negocios', '/marketplace', '/login', '/register'] as const

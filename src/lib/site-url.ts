/**
 * Resuelve la URL base canónica de la aplicación, evitando generar enlaces a
 * localhost cuando una acción se dispara desde un entorno de desarrollo.
 *
 * Prioridad:
 *  1. NEXT_PUBLIC_SITE_URL (dominio canónico configurado)
 *  2. NEXT_PUBLIC_APP_URL (compatibilidad con configuración previa)
 *  3. window.location.origin (solo cliente, último recurso)
 *  4. Fallback duro a producción
 *
 * Sirve tanto en server como en client (las vars NEXT_PUBLIC_ están disponibles
 * en ambos). Devuelve la URL sin barra final.
 */
const FALLBACK_SITE_URL = 'https://servix360.org'

function isLocalhost(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(url)
}

export function getSiteUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '')

  let base = fromEnv || FALLBACK_SITE_URL

  // Red de seguridad: en producción nunca generar enlaces a localhost
  // (env mal configurada en Vercel o acción disparada desde un dev server).
  if (process.env.NODE_ENV === 'production' && isLocalhost(base)) {
    base = FALLBACK_SITE_URL
  }

  return base.replace(/\/+$/, '')
}

/** Construye una URL absoluta a partir de una ruta interna (con barra inicial). */
export function siteUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${getSiteUrl()}${normalized}`
}

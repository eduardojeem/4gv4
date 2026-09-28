/**
 * Consentimiento de cookies/almacenamiento del visitante (solo navegador).
 *
 * - 'all':       acepta la analítica propia (site_analytics_events).
 * - 'essential': solo lo necesario (sesión, carrito, preferencias). La
 *                analítica deja de enviarse y se borran sus identificadores.
 * - null:        todavía no eligió. Se muestra el aviso y la analítica sigue
 *                activa (modelo de aviso con opción de rechazar). Para exigir
 *                aceptación previa, cambiar `isAnalyticsAllowed` a `=== 'all'`.
 */
export type CookieConsent = 'all' | 'essential'

export const COOKIE_CONSENT_KEY = 'mtp-cookie-consent'
export const COOKIE_CONSENT_EVENT = 'mtp:cookie-consent-change'
export const OPEN_COOKIE_PREFERENCES_EVENT = 'mtp:open-cookie-preferences'

/** Claves de la analítica propia (src/lib/site-analytics/client.ts). */
const ANALYTICS_STORAGE_KEYS = ['site-analytics:vid', 'site-analytics:sid']
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export function getCookieConsent(): CookieConsent | null {
  try {
    const value = localStorage.getItem(COOKIE_CONSENT_KEY)
    return value === 'all' || value === 'essential' ? value : null
  } catch {
    return null
  }
}

export function isAnalyticsAllowed(consent: CookieConsent | null = getCookieConsent()): boolean {
  return consent !== 'essential'
}

export function setCookieConsent(consent: CookieConsent): void {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, consent)
    if (consent === 'essential') {
      for (const key of ANALYTICS_STORAGE_KEYS) localStorage.removeItem(key)
    }
  } catch {
    // Sin almacenamiento (modo privado estricto): la elección dura la sesión.
  }
  try {
    // Cookie espejo para que el servidor pueda respetarla si hiciera falta.
    document.cookie = `${COOKIE_CONSENT_KEY}=${consent}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
  } catch {
    // Ignorar: localStorage ya guarda la elección.
  }
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: consent }))
}

export function openCookiePreferences(): void {
  window.dispatchEvent(new Event(OPEN_COOKIE_PREFERENCES_EVENT))
}

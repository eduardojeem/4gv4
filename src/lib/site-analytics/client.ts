import {
  SITE_ANALYTICS_ENDPOINT,
  classifySitePage,
  normalizeSearchTerm,
  type SiteAnalyticsEventType,
} from '@/lib/site-analytics/shared'

const VISITOR_KEY = 'site-analytics:vid'
const SESSION_KEY = 'site-analytics:sid'
const SESSION_IDLE_MS = 30 * 60 * 1000
const DUPLICATE_PAGE_VIEW_MS = 1000

let lastPageView: { path: string; at: number } | null = null

function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function getVisitorId() {
  try {
    const existing = localStorage.getItem(VISITOR_KEY)
    if (existing) return existing
    const created = randomId()
    localStorage.setItem(VISITOR_KEY, created)
    return created
  } catch {
    return randomId()
  }
}

function getSessionId(now: number) {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    const parsed = raw ? (JSON.parse(raw) as { id?: string; t?: number }) : null
    const id = parsed?.id && parsed.t && now - parsed.t < SESSION_IDLE_MS ? parsed.id : randomId()
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id, t: now }))
    return id
  } catch {
    return randomId()
  }
}

function getExternalReferrerHost() {
  try {
    if (!document.referrer) return null
    const host = new URL(document.referrer).hostname
    return host && host !== window.location.hostname ? host.replace(/^www\./, '') : null
  } catch {
    return null
  }
}

function getUtmSource() {
  try {
    const value = new URLSearchParams(window.location.search).get('utm_source')?.trim().toLowerCase()
    return value ? value.slice(0, 64) : null
  } catch {
    return null
  }
}

function send(payload: Record<string, unknown>) {
  const body = JSON.stringify(payload)
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const queued = navigator.sendBeacon(SITE_ANALYTICS_ENDPOINT, new Blob([body], { type: 'application/json' }))
      if (queued) return
    }
    void fetch(SITE_ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // La analítica nunca debe romper la navegación.
  }
}

type TrackExtras = {
  entityId?: string | null
  searchTerm?: string | null
  resultsCount?: number | null
}

function track(type: SiteAnalyticsEventType, pathname: string, extras: TrackExtras = {}) {
  if (typeof window === 'undefined') return
  const page = classifySitePage(pathname)
  if (!page) return

  const now = Date.now()
  send({
    type,
    path: page.path,
    entityId: extras.entityId ?? null,
    searchTerm: extras.searchTerm ?? null,
    resultsCount: extras.resultsCount ?? null,
    visitorId: getVisitorId(),
    sessionId: getSessionId(now),
    referrerHost: type === 'page_view' ? getExternalReferrerHost() : null,
    utmSource: type === 'page_view' ? getUtmSource() : null,
  })
}

export function trackSitePageView(pathname: string) {
  const now = Date.now()
  if (lastPageView && lastPageView.path === pathname && now - lastPageView.at < DUPLICATE_PAGE_VIEW_MS) {
    return
  }
  lastPageView = { path: pathname, at: now }
  track('page_view', pathname)
}

/** Registra una interacción en la página pública actual; no hace nada fuera de tienda/marketplace. */
export function trackSiteEvent(
  type: Exclude<SiteAnalyticsEventType, 'page_view' | 'search'>,
  options: { entityId?: string | null } = {}
) {
  if (typeof window === 'undefined') return
  track(type, window.location.pathname, { entityId: options.entityId })
}

const DUPLICATE_SEARCH_MS = 60 * 1000
let lastSearch: { key: string; at: number } | null = null

export function trackSiteSearch(term: string, resultsCount: number) {
  if (typeof window === 'undefined') return
  const searchTerm = normalizeSearchTerm(term)
  if (!searchTerm) return

  const now = Date.now()
  const key = `${window.location.pathname}|${searchTerm}`
  if (lastSearch && lastSearch.key === key && now - lastSearch.at < DUPLICATE_SEARCH_MS) return
  lastSearch = { key, at: now }

  track('search', window.location.pathname, {
    searchTerm,
    resultsCount: Math.max(0, Math.floor(resultsCount)),
  })
}

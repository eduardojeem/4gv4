import { TENANT_PUBLIC_SECTION_NAMES } from '@/lib/saas/tenant'

export const SITE_ANALYTICS_EVENT_TYPES = [
  'page_view',
  'whatsapp_click',
  'phone_click',
  'add_to_cart',
  'order_placed',
  'search',
] as const

export type SiteAnalyticsEventType = (typeof SITE_ANALYTICS_EVENT_TYPES)[number]

export const SITE_ANALYTICS_SITES = ['storefront', 'marketplace'] as const
export type SiteAnalyticsSite = (typeof SITE_ANALYTICS_SITES)[number]

export const SITE_ANALYTICS_RANGE_DAYS = [1, 7, 30, 90] as const
export type SiteAnalyticsRangeDays = (typeof SITE_ANALYTICS_RANGE_DAYS)[number]
export const DEFAULT_SITE_ANALYTICS_RANGE_DAYS: SiteAnalyticsRangeDays = 30

export const SITE_ANALYTICS_ENDPOINT = '/api/public/analytics/track'

const SAFE_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,47}$/
const SAFE_ENTITY_RE = /^[A-Za-z0-9_-]{1,64}$/
const TENANT_SECTIONS = new Set<string>(TENANT_PUBLIC_SECTION_NAMES)
/** Páginas de la cuenta del cliente: no son visitas a la tienda y no se miden. */
const PRIVATE_TENANT_SECTIONS = new Set(['perfil', 'cliente', 'mis-reparaciones'])
const MARKETPLACE_SECTIONS = new Set(['productos', 'categorias', 'buscar', 'empresas'])

export type ClassifiedPage = {
  site: SiteAnalyticsSite
  orgSlug: string | null
  /** Ruta normalizada: sin query y con cardinalidad acotada (sin ids privados). */
  path: string
  pageType: string
  entityId: string | null
}

/**
 * Decide si una ruta pública se mide y cómo se agrupa. Devuelve null para todo
 * lo que no es tienda pública ni marketplace (dashboard, admin, api, etc.).
 */
export function classifySitePage(pathname: string): ClassifiedPage | null {
  const segments = pathname.split('?')[0].split('#')[0].split('/').filter(Boolean)
  const [first, second, third] = segments

  if (first === 'marketplace') {
    if (!second) {
      return { site: 'marketplace', orgSlug: null, path: '/marketplace', pageType: 'marketplace', entityId: null }
    }
    if (!MARKETPLACE_SECTIONS.has(second)) return null

    if (second === 'empresas' && third) {
      if (!SAFE_SLUG_RE.test(third)) return null
      return {
        site: 'marketplace',
        orgSlug: third,
        path: `/marketplace/empresas/${third}`,
        pageType: 'empresa',
        entityId: null,
      }
    }

    return { site: 'marketplace', orgSlug: null, path: `/marketplace/${second}`, pageType: second, entityId: null }
  }

  if (
    !first ||
    !second ||
    !SAFE_SLUG_RE.test(first) ||
    !TENANT_SECTIONS.has(second) ||
    PRIVATE_TENANT_SECTIONS.has(second)
  ) {
    return null
  }

  if (second === 'productos' && third) {
    if (!SAFE_ENTITY_RE.test(third)) return null
    return {
      site: 'storefront',
      orgSlug: first,
      path: `/${first}/productos/${third}`,
      pageType: 'producto',
      entityId: third,
    }
  }

  return { site: 'storefront', orgSlug: first, path: `/${first}/${second}`, pageType: second, entityId: null }
}

export function isSafeEntityId(value: string) {
  return SAFE_ENTITY_RE.test(value)
}

const SEARCH_TERM_MAX_LENGTH = 80
// Emails y secuencias largas de dígitos (teléfonos, cédulas) no se guardan.
const SEARCH_TERM_PII_RE = /@|\d{6,}/

export function normalizeSearchTerm(value: string | null | undefined): string | null {
  const term = (value ?? '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, SEARCH_TERM_MAX_LENGTH).trim()
  if (term.length < 2 || SEARCH_TERM_PII_RE.test(term.replace(/[\s.-]/g, ''))) return null
  return term
}

export function parseSiteAnalyticsRangeDays(value: string | null | undefined): SiteAnalyticsRangeDays {
  const days = Number(value)
  return (SITE_ANALYTICS_RANGE_DAYS as readonly number[]).includes(days)
    ? (days as SiteAnalyticsRangeDays)
    : DEFAULT_SITE_ANALYTICS_RANGE_DAYS
}

export type SiteAnalyticsSummary = {
  range: { days: number; from: string; to: string; timezone: string }
  totals: {
    page_views: number
    visitors: number
    sessions: number
    bounce_rate: number
    pages_per_session: number
  }
  previous: { page_views: number; visitors: number; orders: number; revenue: number }
  active_now: number
  sales: {
    orders: number
    revenue: number
    average_order_value: number
    /** % de sesiones que terminaron en un pedido. */
    conversion_rate: number
  }
  daily: Array<{ date: string; page_views: number; visitors: number }>
  top_pages: Array<{
    path: string
    page_type: string | null
    product_name: string | null
    page_views: number
    visitors: number
  }>
  top_products: Array<{ product_id: string; name: string | null; views: number; add_to_cart: number }>
  sources: Array<{ source: string; sessions: number; orders: number; revenue: number }>
  devices: Array<{ device: 'mobile' | 'tablet' | 'desktop'; sessions: number }>
  countries: Array<{ country: string; visitors: number }>
  searches: {
    total: number
    without_results: number
    top_terms: Array<{ term: string; searches: number; sessions: number; avg_results: number }>
    without_results_terms: Array<{ term: string; searches: number }>
  }
  interactions: Record<Exclude<SiteAnalyticsEventType, 'page_view' | 'search'>, number>
  funnel: {
    sessions: number
    viewed_product: number
    added_to_cart: number
    contacted_or_ordered: number
  }
  by_site: Array<{ site: SiteAnalyticsSite; page_views: number; visitors: number }>
  top_organizations: Array<{
    organization_id: string
    name: string
    slug: string
    page_views: number
    visitors: number
    marketplace_views: number
    orders: number
    revenue: number
  }>
}

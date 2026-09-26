import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { resolvePublicOrganizationBySlug, resolvePublicStorefrontOrganizationBySlug } from '@/lib/saas/public-tenant'
import type { SiteAnalyticsSite, SiteAnalyticsSummary } from '@/lib/site-analytics/shared'

export const SITE_ANALYTICS_TIMEZONE = 'America/Asuncion'

const BOT_UA_RE =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|preview|facebookexternalhit|whatsapp|telegram|discord|curl|wget|python|axios|node-fetch|go-http|java\//i

export function isBotUserAgent(userAgent: string | null | undefined) {
  return !userAgent || BOT_UA_RE.test(userAgent)
}

export function getDeviceFromUserAgent(userAgent: string): 'mobile' | 'tablet' | 'desktop' {
  if (/ipad|tablet|playbook|silk|kindle|android(?!.*mobile)/i.test(userAgent)) return 'tablet'
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(userAgent)) return 'mobile'
  return 'desktop'
}

export function getCountryFromHeaders(headers: Headers) {
  const value = (headers.get('x-vercel-ip-country') || headers.get('cf-ipcountry') || '').trim().toUpperCase()
  return /^[A-Z]{2}$/.test(value) && value !== 'XX' ? value : null
}

const ORG_CACHE_TTL_MS = 5 * 60 * 1000
const ORG_CACHE_MAX = 500
const orgIdCache = new Map<string, { id: string | null; expiresAt: number }>()

/**
 * Tienda: solo cuenta si está publicada (el slug viaja en la ruta y cualquiera
 * puede mandarlo). Perfil en el marketplace: la organización existente.
 */
export async function resolveOrganizationIdForAnalytics(
  slug: string,
  site: SiteAnalyticsSite,
  supabase: SupabaseClient
) {
  const cacheKey = `${site}:${slug}`
  const cached = orgIdCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.id

  const organization = site === 'storefront'
    ? await resolvePublicStorefrontOrganizationBySlug(slug, supabase)
    : await resolvePublicOrganizationBySlug(slug, supabase)
  const id = organization?.id ?? null

  if (orgIdCache.size >= ORG_CACHE_MAX) orgIdCache.clear()
  orgIdCache.set(cacheKey, { id, expiresAt: Date.now() + ORG_CACHE_TTL_MS })
  return id
}

const STAFF_CACHE_TTL_MS = 5 * 60 * 1000
const STAFF_CACHE_MAX = 1000
const staffCache = new Map<string, { staff: boolean; expiresAt: number }>()

const sessionUserCache = new Map<string, { userId: string | null; expiresAt: number }>()

function getSupabaseSessionCookieKey(request: NextRequest) {
  return request.cookies
    .getAll()
    .filter(({ name }) => name.startsWith('sb-') && name.includes('auth-token'))
    .map(({ name, value }) => `${name}=${value}`)
    .join(';')
}

async function resolveSessionUserId(request: NextRequest, sessionKey: string) {
  const cached = sessionUserCache.get(sessionKey)
  if (cached && cached.expiresAt > Date.now()) return cached.userId

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null

  const authClient = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: () => {},
    },
  })
  const { data } = await authClient.auth.getClaims()
  const userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null

  if (sessionUserCache.size >= STAFF_CACHE_MAX) sessionUserCache.clear()
  sessionUserCache.set(sessionKey, { userId, expiresAt: Date.now() + STAFF_CACHE_TTL_MS })
  return userId
}

/**
 * true si quien navega es super_admin o personal (cualquier rol menos
 * `customer`) de la organización visitada: sus visitas no se cuentan.
 * Visitantes sin sesión no generan ninguna consulta.
 */
export async function isStaffVisitor(
  request: NextRequest,
  organizationId: string | null,
  supabase: SupabaseClient
) {
  const sessionKey = getSupabaseSessionCookieKey(request)
  if (!sessionKey) return false

  const userId = await resolveSessionUserId(request, sessionKey)
  if (!userId) return false

  const cacheKey = `${userId}:${organizationId ?? '-'}`
  const cached = staffCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.staff

  const [{ data: role }, membership] = await Promise.all([
    supabase.from('user_roles').select('role, is_active').eq('user_id', userId).maybeSingle(),
    organizationId
      ? supabase
          .from('organization_members')
          .select('role')
          .eq('user_id', userId)
          .eq('organization_id', organizationId)
          .eq('status', 'active')
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const staff =
    (role?.role === 'super_admin' && role.is_active !== false) ||
    (!!membership.data?.role && membership.data.role !== 'customer')

  if (staffCache.size >= STAFF_CACHE_MAX) staffCache.clear()
  staffCache.set(cacheKey, { staff, expiresAt: Date.now() + STAFF_CACHE_TTL_MS })
  return staff
}

const ORDER_ATTRIBUTION_WINDOW_MS = 2 * 60 * 60 * 1000

/** Monto del pedido recién creado; null si no existe, es de otra organización o es viejo. */
export async function getOrderValueForAnalytics(
  orderId: string,
  organizationId: string,
  supabase: SupabaseClient
) {
  const { data } = await supabase
    .from('customer_orders')
    .select('total, created_at')
    .eq('id', orderId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!data) return null
  const createdAt = new Date(String(data.created_at)).getTime()
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > ORDER_ATTRIBUTION_WINDOW_MS) return null

  const total = Number(data.total)
  return Number.isFinite(total) ? total : null
}

export async function fetchSiteAnalyticsSummary(
  supabase: SupabaseClient,
  options: { days: number; organizationId?: string | null; site?: SiteAnalyticsSite | null }
): Promise<SiteAnalyticsSummary> {
  const { data, error } = await supabase.rpc('get_site_analytics_summary', {
    p_days: options.days,
    p_organization_id: options.organizationId ?? null,
    p_site: options.site ?? null,
    p_tz: SITE_ANALYTICS_TIMEZONE,
  })

  if (error) throw error
  return data as SiteAnalyticsSummary
}

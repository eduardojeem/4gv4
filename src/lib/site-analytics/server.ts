import type { SupabaseClient } from '@supabase/supabase-js'
import { resolvePublicOrganizationBySlug } from '@/lib/saas/public-tenant'
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

export async function resolveOrganizationIdForAnalytics(slug: string, supabase: SupabaseClient) {
  const cached = orgIdCache.get(slug)
  if (cached && cached.expiresAt > Date.now()) return cached.id

  const organization = await resolvePublicOrganizationBySlug(slug, supabase)
  const id = organization?.id ?? null

  if (orgIdCache.size >= ORG_CACHE_MAX) orgIdCache.clear()
  orgIdCache.set(slug, { id, expiresAt: Date.now() + ORG_CACHE_TTL_MS })
  return id
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

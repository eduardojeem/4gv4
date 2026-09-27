import { NextRequest, NextResponse } from 'next/server'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import {
  SITE_ANALYTICS_SITES,
  parseSiteAnalyticsRangeDays,
  type SiteAnalyticsSite,
} from '@/lib/site-analytics/shared'
import { fetchSiteAnalyticsSummary } from '@/lib/site-analytics/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * GET /api/superadmin/analytics/website?days=30&site=storefront|marketplace&organizationId=<uuid>
 * Visitas de toda la plataforma (tiendas + marketplace), filtrables por sitio y organización.
 */
export async function GET(request: NextRequest) {
  const user = await getSuperAdminUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const days = parseSiteAnalyticsRangeDays(params.get('days'))
  const siteParam = params.get('site')
  const site = (SITE_ANALYTICS_SITES as readonly string[]).includes(siteParam ?? '')
    ? (siteParam as SiteAnalyticsSite)
    : null
  const organizationParam = params.get('organizationId')
  const organizationId = organizationParam && UUID_RE.test(organizationParam) ? organizationParam : null

  try {
    const supabase = createAdminSupabase()
    const summary = await fetchSiteAnalyticsSummary(supabase, { days, organizationId, site })
    return NextResponse.json({ success: true, data: { summary } })
  } catch (error) {
    logger.error('[superadmin/analytics/website] Error loading summary', { error })
    return NextResponse.json({ success: false, error: 'Error al cargar las visitas' }, { status: 500 })
  }
}

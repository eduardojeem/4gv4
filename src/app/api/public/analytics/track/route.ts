import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { rateLimiter, getClientIp } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import {
  SITE_ANALYTICS_EVENT_TYPES,
  classifySitePage,
  isSafeEntityId,
} from '@/lib/site-analytics/shared'
import {
  getCountryFromHeaders,
  getDeviceFromUserAgent,
  isBotUserAgent,
  resolveOrganizationIdForAnalytics,
} from '@/lib/site-analytics/server'

const TRACK_RATE_LIMIT = 240
const TRACK_RATE_WINDOW_MS = 5 * 60 * 1000
const MAX_BODY_BYTES = 2048

const trackSchema = z.object({
  type: z.enum(SITE_ANALYTICS_EVENT_TYPES),
  path: z.string().min(1).max(300),
  entityId: z.string().max(64).nullable().optional(),
  visitorId: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
  sessionId: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
  referrerHost: z.string().max(253).regex(/^[a-z0-9.-]+$/i).nullable().optional(),
  utmSource: z.string().max(64).nullable().optional(),
})

const noContent = () => new NextResponse(null, { status: 204 })

/**
 * POST /api/public/analytics/track
 * Recibe visitas e interacciones desde las tiendas públicas y el marketplace.
 * Siempre responde 204 ante eventos ignorados para no dar pistas a scrapers.
 */
export async function POST(request: NextRequest) {
  if (isBotUserAgent(request.headers.get('user-agent'))) {
    return noContent()
  }

  const allowed = await rateLimiter.check(
    `site-analytics:${getClientIp(request)}`,
    TRACK_RATE_LIMIT,
    TRACK_RATE_WINDOW_MS
  )
  if (!allowed) {
    return NextResponse.json({ success: false }, { status: 429 })
  }

  let payload: z.infer<typeof trackSchema>
  try {
    const raw = await request.text()
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ success: false }, { status: 413 })
    }
    const parsed = trackSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      return NextResponse.json({ success: false }, { status: 400 })
    }
    payload = parsed.data
  } catch {
    return NextResponse.json({ success: false }, { status: 400 })
  }

  // El sitio, la empresa y el tipo de página se derivan de la ruta en el
  // servidor; el cliente no puede atribuir visitas a otra organización.
  const page = classifySitePage(payload.path)
  if (!page) {
    return noContent()
  }

  const entityId = payload.type === 'page_view'
    ? page.entityId
    : payload.entityId && isSafeEntityId(payload.entityId) ? payload.entityId : null

  try {
    const supabase = createAdminSupabase()
    const organizationId = page.orgSlug
      ? await resolveOrganizationIdForAnalytics(page.orgSlug, supabase)
      : null

    if (page.site === 'storefront' && !organizationId) {
      return noContent()
    }

    const userAgent = request.headers.get('user-agent') ?? ''
    const { error } = await supabase.from('site_analytics_events').insert({
      organization_id: organizationId,
      site: page.site,
      event_type: payload.type,
      path: page.path,
      page_type: payload.type === 'page_view' ? page.pageType : null,
      entity_id: entityId,
      visitor_id: payload.visitorId,
      session_id: payload.sessionId,
      referrer_host: payload.referrerHost?.toLowerCase() ?? null,
      utm_source: payload.utmSource?.trim().toLowerCase() || null,
      device: getDeviceFromUserAgent(userAgent),
      country: getCountryFromHeaders(request.headers),
    })

    if (error) {
      logger.error('[site-analytics] Error inserting event', { error })
    }
  } catch (error) {
    logger.error('[site-analytics] Unexpected error', { error })
  }

  return noContent()
}

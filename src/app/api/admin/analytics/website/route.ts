import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { logger } from '@/lib/logger'
import { parseSiteAnalyticsRangeDays } from '@/lib/site-analytics/shared'
import { fetchSiteAnalyticsSummary } from '@/lib/site-analytics/server'

/**
 * GET /api/admin/analytics/website?days=1|7|30|90
 * Visitas e interacciones del sitio público de la organización activa.
 */
async function getHandler(request: NextRequest, context: AdminAuthContext) {
  let organizationId = context.organizationId

  // super_admin no trae organización en el contexto: usa la organización activa.
  if (!organizationId && context.user.role === 'super_admin') {
    organizationId = (await getCurrentOrganizationContext(context.user.id).catch(() => null))?.id ?? null
  }

  if (!organizationId) {
    return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 403 })
  }

  const days = parseSiteAnalyticsRangeDays(request.nextUrl.searchParams.get('days'))

  try {
    const supabase = createAdminSupabase()
    const [summary, { data: organization }] = await Promise.all([
      fetchSiteAnalyticsSummary(supabase, { days, organizationId }),
      supabase.from('organizations').select('name, slug').eq('id', organizationId).maybeSingle(),
    ])

    return NextResponse.json({
      success: true,
      data: {
        organization: organization ? { name: organization.name, slug: organization.slug } : null,
        summary,
      },
    })
  } catch (error) {
    logger.error('[admin/analytics/website] Error loading summary', { error, organizationId })
    return NextResponse.json({ success: false, error: 'Error al cargar las visitas' }, { status: 500 })
  }
}

export const GET = withAdminAuth(getHandler)

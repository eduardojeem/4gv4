import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

/**
 * GET /api/admin/reviews?status=pending|approved|all&limit=20&offset=0
 * Listar reseñas de la organización (con filtros)
 */
async function getHandler(request: NextRequest, context: AdminAuthContext) {
  try {
    const supabase = createAdminSupabase()
    const orgId = context.organizationId

    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const limit = Math.min(Number(searchParams.get('limit') || 20), 100)
    const offset = Math.max(Number(searchParams.get('offset') || 0), 0)

    let query = supabase
      .from('organization_reviews')
      .select('*', { count: 'exact' })
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status === 'pending') {
      query = query.eq('is_approved', false)
    } else if (status === 'approved') {
      query = query.eq('is_approved', true)
    }

    const { data: reviews, error, count } = await query

    if (error) {
      logger.error('[admin/reviews] Error fetching', { error })
      return NextResponse.json(
        { success: false, error: 'Error al obtener reseñas' },
        { status: 500 }
      )
    }

    // Stats
    const { data: org } = await supabase
      .from('organizations')
      .select('review_rating_avg, review_count')
      .eq('id', orgId)
      .single()

    return NextResponse.json({
      success: true,
      data: {
        reviews: reviews ?? [],
        stats: {
          average: Number(org?.review_rating_avg ?? 0),
          count: org?.review_count ?? 0,
        },
        pagination: { total: count ?? 0, limit, offset },
      },
    })
  } catch (error) {
    logger.error('[admin/reviews] Unexpected error', { error })
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    )
  }
}

export const GET = withAdminAuth(getHandler)

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

const statusSchema = z.enum(['pending', 'published', 'rejected', 'hidden', 'reported', 'all'])
const verificationSchema = z.enum(['open', 'purchase', 'repair', 'verified', 'all'])

const bulkActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'show', 'hide']),
  ids: z.array(z.uuid()).min(1).max(100),
  moderation_reason: z.string().trim().min(3).max(500).optional(),
}).superRefine((value, context) => {
  if (['reject', 'hide'].includes(value.action) && !value.moderation_reason) {
    context.addIssue({ code: 'custom', path: ['moderation_reason'], message: 'Indica el motivo de moderación.' })
  }
})

function safeInteger(value: string | null, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.trunc(parsed), minimum), maximum)
}

async function getHandler(request: NextRequest, context: AdminAuthContext) {
  try {
    const supabase = createAdminSupabase()
    const orgId = context.organizationId
    if (!orgId) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = statusSchema.catch('all').parse(searchParams.get('status') || 'all')
    const verification = verificationSchema.catch('all').parse(searchParams.get('verification') || 'all')
    const rating = safeInteger(searchParams.get('rating'), 0, 0, 5)
    const search = searchParams.get('search')?.trim() || ''
    const sort = searchParams.get('sort') || 'newest'
    const limit = safeInteger(searchParams.get('limit'), 20, 1, 100)
    const offset = safeInteger(searchParams.get('offset'), 0, 0, Number.MAX_SAFE_INTEGER)

    let query = supabase
      .from('organization_reviews')
      .select('*', { count: 'exact' })
      .eq('organization_id', orgId)

    if (status !== 'all') query = query.eq('moderation_status', status)
    if (verification === 'verified') {
      query = query.in('verification_type', ['purchase', 'repair'])
    } else if (verification !== 'all') {
      query = query.eq('verification_type', verification)
    }
    if (rating >= 1) query = query.eq('rating', rating)

    const sanitizedSearch = search.replace(/[%_,().]/g, '').slice(0, 100)
    if (sanitizedSearch) {
      query = query.or(
        `reviewer_name.ilike.%${sanitizedSearch}%,reviewer_email.ilike.%${sanitizedSearch}%,comment.ilike.%${sanitizedSearch}%`,
      )
    }

    if (sort === 'oldest') {
      query = query.order('created_at', { ascending: true })
    } else if (sort === 'rating_desc') {
      query = query.order('rating', { ascending: false }).order('created_at', { ascending: false })
    } else if (sort === 'rating_asc') {
      query = query.order('rating', { ascending: true }).order('created_at', { ascending: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    const [{ data: reviews, error, count }, { data: org }, { data: statsRows, error: statsError }] = await Promise.all([
      query.range(offset, offset + limit - 1),
      supabase.from('organizations').select('slug, name').eq('id', orgId).single(),
      supabase.rpc('get_organization_review_admin_stats', { p_organization_id: orgId }),
    ])

    if (error || statsError) {
      logger.error('[admin/reviews] Error fetching reviews', { error, statsError })
      return NextResponse.json({ success: false, error: 'Error al obtener reseñas' }, { status: 500 })
    }

    const stats = statsRows?.[0]
    const breakdown = stats?.breakdown ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    const verifiedCount = Number(stats?.verified_count ?? 0)
    const respondedCount = Number(stats?.responded_count ?? 0)
    const satisfactionRate = Number(stats?.satisfaction_rate ?? 0)

    return NextResponse.json({
      success: true,
      data: {
        reviews: reviews ?? [],
        stats: {
          average: Number(stats?.average ?? 0),
          count: Number(stats?.published ?? 0),
          total: Number(stats?.total ?? 0),
          pending: Number(stats?.pending ?? 0),
          approved: Number(stats?.published ?? 0),
          published: Number(stats?.published ?? 0),
          rejected: Number(stats?.rejected ?? 0),
          hidden: Number(stats?.hidden ?? 0),
          reported: Number(stats?.reported ?? 0),
          verifiedAverage: Number(stats?.verified_average ?? 0),
          verifiedCount,
          respondedCount,
          breakdown,
          satisfactionRate,
          storeSlug: org?.slug || null,
          storeName: org?.name || 'Mi Tienda',
        },
        pagination: { total: count ?? 0, limit, offset },
      },
    })
  } catch (error) {
    logger.error('[admin/reviews] Unexpected error in GET', { error })
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}

async function patchBulkHandler(request: NextRequest, context: AdminAuthContext) {
  try {
    const supabase = createAdminSupabase()
    const orgId = context.organizationId
    if (!orgId) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 403 })
    }

    const parsed = bulkActionSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos para acción en lote', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { action, ids, moderation_reason } = parsed.data
    const now = new Date().toISOString()
    const moderationStatus = action === 'approve' || action === 'show'
      ? 'published'
      : action === 'reject'
        ? 'rejected'
        : 'hidden'

    const { error } = await supabase
      .from('organization_reviews')
      .update({
        moderation_status: moderationStatus,
        moderation_reason: moderationStatus === 'published' ? null : moderation_reason,
        moderated_at: now,
        moderated_by: context.user.id,
        updated_at: now,
      })
      .eq('organization_id', orgId)
      .in('id', ids)

    if (error) {
      logger.error('[admin/reviews] Error in bulk update', { error, action })
      return NextResponse.json({ success: false, error: 'Error al actualizar reseñas' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Reseñas actualizadas correctamente' })
  } catch (error) {
    logger.error('[admin/reviews] Unexpected error in bulk PATCH', { error })
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 })
  }
}

export const GET = withAdminAuth(getHandler)
export const PATCH = withAdminAuth(patchBulkHandler)

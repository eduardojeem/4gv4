import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

const bulkActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'show', 'hide', 'delete', 'approve_all_pending']),
  ids: z.array(z.string()).optional().default([]),
})

/**
 * GET /api/admin/reviews?status=pending|approved|hidden|all&rating=1..5&search=text&sort=newest|oldest|rating_desc|rating_asc&limit=20&offset=0
 * Listar reseñas de la organización con filtros avanzados, búsqueda y métricas
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
    const ratingParam = searchParams.get('rating')
    const rating = ratingParam ? Number(ratingParam) : null
    const search = searchParams.get('search')?.trim() || ''
    const sort = searchParams.get('sort') || 'newest'
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 20), 1), 100)
    const offset = Math.max(Number(searchParams.get('offset') || 0), 0)

    let query = supabase
      .from('organization_reviews')
      .select('*', { count: 'exact' })
      .eq('organization_id', orgId)

    // Filtro por estado
    if (status === 'pending') {
      query = query.eq('is_approved', false)
    } else if (status === 'approved') {
      query = query.eq('is_approved', true).eq('is_visible', true)
    } else if (status === 'hidden') {
      query = query.eq('is_approved', true).eq('is_visible', false)
    }

    // Filtro por calificación exacta
    if (rating && rating >= 1 && rating <= 5) {
      query = query.eq('rating', rating)
    }

    // Filtro por búsqueda de texto
    if (search) {
      const sanitized = search.replace(/[%_,]/g, '')
      if (sanitized) {
        query = query.or(
          `reviewer_name.ilike.%${sanitized}%,reviewer_email.ilike.%${sanitized}%,comment.ilike.%${sanitized}%`
        )
      }
    }

    // Ordenamiento
    if (sort === 'oldest') {
      query = query.order('created_at', { ascending: true })
    } else if (sort === 'rating_desc') {
      query = query.order('rating', { ascending: false }).order('created_at', { ascending: false })
    } else if (sort === 'rating_asc') {
      query = query.order('rating', { ascending: true }).order('created_at', { ascending: false })
    } else {
      // Default: newest
      query = query.order('created_at', { ascending: false })
    }

    query = query.range(offset, offset + limit - 1)

    const { data: reviews, error, count } = await query

    if (error) {
      logger.error('[admin/reviews] Error fetching reviews', { error })
      return NextResponse.json(
        { success: false, error: 'Error al obtener reseñas' },
        { status: 500 }
      )
    }

    // Consultar datos de la organización y todas las reseñas para estadísticas precisas
    const [{ data: org }, { data: allReviews }] = await Promise.all([
      supabase
        .from('organizations')
        .select('slug, name, review_rating_avg, review_count')
        .eq('id', orgId)
        .single(),
      supabase
        .from('organization_reviews')
        .select('rating, is_approved, is_visible')
        .eq('organization_id', orgId),
    ])

    const breakdown: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    let approvedCount = 0
    let hiddenCount = 0
    let pendingCount = 0
    let sumRatingApproved = 0

    if (Array.isArray(allReviews)) {
      for (const r of allReviews) {
        if (!r.is_approved) {
          pendingCount++
        } else if (!r.is_visible) {
          hiddenCount++
        } else {
          approvedCount++
          sumRatingApproved += Number(r.rating || 0)
        }

        const stars = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5
        breakdown[stars] = (breakdown[stars] || 0) + 1
      }
    }

    const totalAll = (allReviews ?? []).length
    const computedAverage = approvedCount > 0
      ? Number((sumRatingApproved / approvedCount).toFixed(1))
      : Number(org?.review_rating_avg ?? 0)

    const satisfiedCount = (breakdown[4] || 0) + (breakdown[5] || 0)
    const satisfactionRate = totalAll > 0 ? Math.round((satisfiedCount / totalAll) * 100) : 100

    return NextResponse.json({
      success: true,
      data: {
        reviews: reviews ?? [],
        stats: {
          average: computedAverage,
          count: approvedCount,
          total: totalAll,
          pending: pendingCount,
          approved: approvedCount,
          hidden: hiddenCount,
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
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/reviews
 * Acciones en lote: aprobar, rechazar, ocultar, mostrar, eliminar o aprobar todas las pendientes
 */
async function patchBulkHandler(request: NextRequest, context: AdminAuthContext) {
  try {
    const supabase = createAdminSupabase()
    const orgId = context.organizationId

    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => null)
    const parsed = bulkActionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos para acción en lote', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { action, ids } = parsed.data
    const now = new Date().toISOString()

    if (action === 'approve_all_pending') {
      const { error } = await supabase
        .from('organization_reviews')
        .update({ is_approved: true, is_visible: true, updated_at: now })
        .eq('organization_id', orgId)
        .eq('is_approved', false)

      if (error) {
        logger.error('[admin/reviews] Error in approve_all_pending', { error })
        return NextResponse.json({ success: false, error: 'No se pudieron aprobar las reseñas' }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: 'Todas las reseñas pendientes fueron aprobadas' })
    }

    if (!ids || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Se requiere al menos una reseña seleccionada' },
        { status: 400 }
      )
    }

    if (action === 'delete') {
      const { error } = await supabase
        .from('organization_reviews')
        .delete()
        .eq('organization_id', orgId)
        .in('id', ids)

      if (error) {
        logger.error('[admin/reviews] Error in bulk delete', { error })
        return NextResponse.json({ success: false, error: 'No se pudieron eliminar las reseñas' }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: `${ids.length} reseña(s) eliminada(s)` })
    }

    let updates: { is_approved?: boolean; is_visible?: boolean; updated_at: string }

    if (action === 'approve') {
      updates = { is_approved: true, is_visible: true, updated_at: now }
    } else if (action === 'reject') {
      updates = { is_approved: false, is_visible: false, updated_at: now }
    } else if (action === 'show') {
      updates = { is_visible: true, updated_at: now }
    } else if (action === 'hide') {
      updates = { is_visible: false, updated_at: now }
    } else {
      return NextResponse.json({ success: false, error: 'Acción no reconocida' }, { status: 400 })
    }

    const { error } = await supabase
      .from('organization_reviews')
      .update(updates)
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

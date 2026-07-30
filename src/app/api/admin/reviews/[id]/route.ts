import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const updateSchema = z.object({
  is_approved: z.boolean().optional(),
  is_visible: z.boolean().optional(),
})

/**
 * PATCH /api/admin/reviews/[id]
 * Aprobar/rechazar/ocultar una reseña
 */
async function patchHandler(
  request: NextRequest,
  context: AdminAuthContext & { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const supabase = createAdminSupabase()
    const orgId = context.organizationId

    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validation = updateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: validation.error.issues },
        { status: 400 }
      )
    }

    const updates = {
      ...validation.data,
      updated_at: new Date().toISOString(),
    }

    const { data: review, error } = await supabase
      .from('organization_reviews')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', orgId)
      .select('*')
      .single()

    if (error || !review) {
      return NextResponse.json(
        { success: false, error: 'Reseña no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: review })
  } catch (error) {
    logger.error('[admin/reviews] Patch error', { error })
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/reviews/[id]
 * Eliminar una reseña permanentemente
 */
async function deleteHandler(
  request: NextRequest,
  context: AdminAuthContext & { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const supabase = createAdminSupabase()
    const orgId = context.organizationId

    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 403 }
      )
    }

    const { data: deletedReview, error } = await supabase
      .from('organization_reviews')
      .delete()
      .eq('id', id)
      .eq('organization_id', orgId)
      .select('id')
      .maybeSingle()

    if (error) {
      logger.error('[admin/reviews] Delete error', { error })
      return NextResponse.json(
        { success: false, error: 'No se pudo eliminar la reseña' },
        { status: 500 }
      )
    }

    if (!deletedReview) {
      return NextResponse.json(
        { success: false, error: 'Reseña no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('[admin/reviews] Unexpected error', { error })
    return NextResponse.json(
      { success: false, error: 'Error interno' },
      { status: 500 }
    )
  }
}

export function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAdminAuth((req, authCtx) =>
    patchHandler(req, { ...authCtx, params: context.params })
  )(request)
}

export function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAdminAuth((req, authCtx) =>
    deleteHandler(req, { ...authCtx, params: context.params })
  )(request)
}

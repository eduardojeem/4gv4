import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAdminAuth, type AdminAuthContext } from '@/lib/api/withAdminAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

const updateSchema = z.object({
  moderation_status: z.enum(['pending', 'published', 'rejected', 'hidden', 'reported']).optional(),
  moderation_reason: z.string().trim().min(3).max(500).nullable().optional(),
  business_response: z.string().trim().min(2).max(1000).nullable().optional(),
}).superRefine((value, context) => {
  if (
    value.moderation_status &&
    ['rejected', 'hidden', 'reported'].includes(value.moderation_status) &&
    !value.moderation_reason
  ) {
    context.addIssue({ code: 'custom', path: ['moderation_reason'], message: 'Indica el motivo de moderación.' })
  }
})

async function patchHandler(
  request: NextRequest,
  context: AdminAuthContext & { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const orgId = context.organizationId
    if (!orgId) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 403 })
    }

    const validation = updateSchema.safeParse(await request.json().catch(() => null))
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: validation.error.issues },
        { status: 400 },
      )
    }

    const now = new Date().toISOString()
    const updates: Record<string, string | null> = { updated_at: now }
    if (validation.data.moderation_status) {
      updates.moderation_status = validation.data.moderation_status
      updates.moderation_reason = validation.data.moderation_status === 'published'
        ? null
        : validation.data.moderation_reason ?? null
      updates.moderated_at = now
      updates.moderated_by = context.user.id
    }
    if (validation.data.business_response !== undefined) {
      updates.business_response = validation.data.business_response
      updates.responded_at = validation.data.business_response ? now : null
      updates.responded_by = validation.data.business_response ? context.user.id : null
    }

    const supabase = createAdminSupabase()
    const { data: review, error } = await supabase
      .from('organization_reviews')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', orgId)
      .select('*')
      .maybeSingle()

    if (error) {
      logger.error('[admin/reviews] Patch error', { error })
      return NextResponse.json({ success: false, error: 'No se pudo actualizar la reseña' }, { status: 500 })
    }
    if (!review) {
      return NextResponse.json({ success: false, error: 'Reseña no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: review })
  } catch (error) {
    logger.error('[admin/reviews] Unexpected patch error', { error })
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}

export function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withAdminAuth((req, authContext) => patchHandler(req, { ...authContext, params: context.params }))(request)
}

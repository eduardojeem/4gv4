import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

interface MarkReadBody {
  notificationId?: string
  id?: string
  all?: boolean
  dismiss?: boolean
}

/**
 * POST /api/notifications/read
 * Marca una o todas las notificaciones operativas como leídas para el usuario autenticado.
 * Mantiene compatibilidad con descartes de notificaciones globales si se envía dismiss: true.
 */
export const POST = withTenantAuth({}, async (request, { user, organization }) => {
  try {
    const body = (await request.json().catch(() => ({}))) as MarkReadBody

    // Compatibilidad legacy con descarte de notificaciones globales
    if (body.dismiss === true) {
      const admin = createAdminSupabase()
      const globalId = body.id || body.notificationId
      if (!globalId) {
        return NextResponse.json({ error: 'ID requerido para descartar.' }, { status: 400 })
      }

      await admin.from('global_notification_reads').upsert(
        {
          notification_id: globalId,
          user_id: user.id,
          read_at: new Date().toISOString(),
          dismissed: true,
        },
        { onConflict: 'notification_id,user_id' }
      )

      return NextResponse.json({ success: true, dismissed: true })
    }

    const admin = createAdminSupabase()
    const targetNotificationId = body.notificationId || body.id

    // 1. Marcar una notificación individual como leída
    if (targetNotificationId) {
      const { data, error } = await admin
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', targetNotificationId)
        .eq('user_id', user.id)
        .eq('organization_id', organization.id)
        .is('read_at', null)
        .select('id')

      if (error) {
        logger.error('Failed to mark notification as read', { error, userId: user.id, notificationId: targetNotificationId })
        return NextResponse.json({ error: 'No se pudo marcar la notificación como leída.' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        updatedCount: data ? data.length : 0,
      })
    }

    // 2. Marcar todas las notificaciones como leídas
    if (body.all === true) {
      const { data, error } = await admin
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('organization_id', organization.id)
        .is('read_at', null)
        .select('id')

      if (error) {
        logger.error('Failed to mark all notifications as read', { error, userId: user.id, orgId: organization.id })
        return NextResponse.json({ error: 'No se pudieron marcar las notificaciones como leídas.' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        updatedCount: data ? data.length : 0,
      })
    }

    return NextResponse.json(
      { error: 'Se requiere notificationId o all: true para marcar como leído.' },
      { status: 400 }
    )
  } catch (error) {
    logger.error('Notifications read POST error', { error })
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 })
  }
})

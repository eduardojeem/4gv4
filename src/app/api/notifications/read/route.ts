import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

// Marca notificaciones globales como leídas o descartadas para el usuario actual.
//   { id }            -> marca una como leída
//   { id, dismiss }   -> marca una como leída y descartada (la oculta)
//   { all: true }     -> marca todas las visibles como leídas
export const POST = withTenantAuth({}, async (request, { user, organization }) => {
  try {
    const body = await request.json().catch(() => ({})) as {
      id?: string
      all?: boolean
      dismiss?: boolean
    }

    const admin = createAdminSupabase()

    let ids: string[] = []
    if (body.all) {
      const { data } = await admin
        .from('global_notifications')
        .select('id')
        .eq('status', 'sent')
        .or(`target.eq.all,target_org_ids.cs.{${organization.id}}`)
      ids = (data ?? []).map(r => r.id as string)
    } else if (body.id) {
      ids = [body.id]
    }

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Sin notificaciones para actualizar.' }, { status: 400 })
    }

    const isDismiss = body.dismiss === true

    // Al solo marcar como leídas (sin descartar) hay que EXCLUIR las que el
    // usuario ya descartó: el upsert reescribe la fila completa y, con
    // `dismissed: false`, resucitaría notificaciones ocultas ("marcar todas
    // como leídas" las hacía reaparecer).
    if (!isDismiss) {
      const { data: dismissedRows } = await admin
        .from('global_notification_reads')
        .select('notification_id')
        .eq('user_id', user.id)
        .eq('dismissed', true)
        .in('notification_id', ids)

      const dismissedIds = new Set((dismissedRows ?? []).map(r => r.notification_id as string))
      ids = ids.filter(id => !dismissedIds.has(id))

      if (ids.length === 0) {
        return NextResponse.json({ ok: true, updated: 0 })
      }
    }

    const now = new Date().toISOString()
    const rows = ids.map(notification_id => ({
      notification_id,
      user_id: user.id,
      read_at: now,
      dismissed: isDismiss,
    }))

    const { error } = await admin
      .from('global_notification_reads')
      .upsert(rows, { onConflict: 'notification_id,user_id' })

    if (error) {
      logger.error('Failed to mark notifications read', { error, userId: user.id })
      return NextResponse.json({ error: 'No se pudo actualizar.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, updated: ids.length })
  } catch (error) {
    logger.error('Notifications read POST error', { error })
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 })
  }
})

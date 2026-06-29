import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

type NotificationRow = {
  id: string
  title: string
  body: string
  type: 'info' | 'warning' | 'success' | 'danger'
  target: 'all' | 'specific'
  target_org_ids: string[] | null
  sent_at: string | null
  created_at: string
}

// Notificaciones globales (enviadas por el superadmin) visibles para la
// organización del usuario, junto con su estado de lectura individual.
export const GET = withTenantAuth({}, async (_request, { user, organization }) => {
  try {
    const admin = createAdminSupabase()

    // Solo notificaciones ya enviadas y dirigidas a esta org (o a todas).
    const { data: notifications, error } = await admin
      .from('global_notifications')
      .select('id, title, body, type, target, target_org_ids, sent_at, created_at')
      .eq('status', 'sent')
      .or(`target.eq.all,target_org_ids.cs.{${organization.id}}`)
      .order('sent_at', { ascending: false, nullsFirst: false })
      .limit(50)

    if (error) {
      logger.error('Failed to load global notifications', { error, orgId: organization.id })
      return NextResponse.json({ error: 'No se pudieron cargar las notificaciones.' }, { status: 500 })
    }

    const rows = (notifications ?? []) as NotificationRow[]
    if (rows.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const { data: reads } = await admin
      .from('global_notification_reads')
      .select('notification_id, dismissed')
      .eq('user_id', user.id)
      .in('notification_id', rows.map(r => r.id))

    const readMap = new Map<string, boolean>(
      (reads ?? []).map(r => [r.notification_id as string, true]),
    )
    const dismissedSet = new Set<string>(
      (reads ?? []).filter(r => r.dismissed).map(r => r.notification_id as string),
    )

    const data = rows
      .filter(r => !dismissedSet.has(r.id))
      .map(r => ({
        id: r.id,
        title: r.title,
        body: r.body,
        type: r.type,
        read: readMap.has(r.id),
        timestamp: r.sent_at ?? r.created_at,
      }))

    return NextResponse.json({ data })
  } catch (error) {
    logger.error('Notifications GET error', { error })
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 })
  }
})

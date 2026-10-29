import { NextRequest, NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

interface NotificationDbRow {
  id: string
  organization_id: string
  branch_id: string | null
  user_id: string
  type: string
  title: string
  body: string
  data: Record<string, unknown>
  resource_type: string | null
  resource_id: string | null
  read_at: string | null
  created_at: string
}

type GlobalNotificationRow = {
  id: string
  title: string
  body: string
  type: 'info' | 'warning' | 'success' | 'danger'
  target: 'all' | 'specific'
  target_org_ids: string[] | null
  sent_at: string | null
  created_at: string
}

/**
 * GET /api/notifications
 * Bandeja de notificaciones operativas con soporte para paginación por cursor.
 * Si se solicita scope=global, mantiene compatibilidad con anuncios generales del superadmin.
 */
export const GET = withTenantAuth({}, async (request: NextRequest, { user, organization }) => {
  const { searchParams } = new URL(request.url)
  const scope = searchParams.get('scope')

  // Soporte legacy/global para avisos del SuperAdmin
  if (scope === 'global') {
    try {
      const admin = createAdminSupabase()
      await admin.rpc('dispatch_due_global_notifications')

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

      const rows = (notifications ?? []) as GlobalNotificationRow[]
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
      logger.error('Global notifications GET error', { error })
      return NextResponse.json({ error: 'Error interno.' }, { status: 500 })
    }
  }

  // Notificaciones operativas del negocio (Phase 2)
  try {
    const rawLimit = Number(searchParams.get('limit')) || 20
    const limit = Math.min(Math.max(rawLimit, 1), 50)
    const cursor = searchParams.get('cursor')

    const admin = createAdminSupabase()
    let query = admin
      .from('notifications')
      .select('id, organization_id, branch_id, user_id, type, title, body, data, resource_type, resource_id, read_at, created_at')
      .eq('user_id', user.id)
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false })
      .limit(limit + 1)

    if (cursor) {
      query = query.lt('created_at', cursor)
    }

    const { data, error } = await query

    if (error) {
      logger.error('Failed to load notifications feed', { error, userId: user.id, orgId: organization.id })
      return NextResponse.json({ error: 'No se pudieron cargar las notificaciones.' }, { status: 500 })
    }

    const rows = (data ?? []) as NotificationDbRow[]
    const hasMore = rows.length > limit
    const items = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].created_at : null

    return NextResponse.json({
      items: items.map((row) => ({
        id: row.id,
        organizationId: row.organization_id,
        branchId: row.branch_id,
        userId: row.user_id,
        type: row.type,
        title: row.title,
        body: row.body,
        data: row.data,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        readAt: row.read_at,
        createdAt: row.created_at,
      })),
      nextCursor,
    })
  } catch (error) {
    logger.error('Notifications feed GET error', { error })
    return NextResponse.json({ error: 'Error interno al cargar la bandeja de notificaciones.' }, { status: 500 })
  }
})

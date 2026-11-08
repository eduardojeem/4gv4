import { NextRequest, NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { loadGlobalAnnouncements } from '@/lib/notifications/global-announcements'

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
      // Los programados los publica pg_cron cada minuto: leer la bandeja no escribe en la base.
      const { items, error } = await loadGlobalAnnouncements(createAdminSupabase(), organization.id, user.id)
      if (error) {
        logger.error('Failed to load global notifications', { error, orgId: organization.id })
        return NextResponse.json({ error: 'No se pudieron cargar las notificaciones.' }, { status: 500 })
      }
      return NextResponse.json({ data: items })
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
      .order('id', { ascending: false })
      .limit(limit + 1)

    if (cursor) {
      const [rawTimestamp, id] = cursor.split('|')
      const timestamp = Number.isFinite(Date.parse(rawTimestamp)) ? new Date(rawTimestamp).toISOString() : ''
      if (!Number.isFinite(Date.parse(timestamp)) || (id && !/^[0-9a-f-]{36}$/i.test(id))) return NextResponse.json({ error: 'Cursor inválido.' }, { status: 400 })
      query = id ? query.or(`created_at.lt.${timestamp},and(created_at.eq.${timestamp},id.lt.${id})`) : query.lt('created_at', timestamp)
    }

    const { data, error } = await query

    if (error) {
      logger.error('Failed to load notifications feed', { error, userId: user.id, orgId: organization.id })
      return NextResponse.json({ error: 'No se pudieron cargar las notificaciones.' }, { status: 500 })
    }

    const rows = (data ?? []) as NotificationDbRow[]
    const hasMore = rows.length > limit
    const items = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore && items.length > 0 ? `${items[items.length - 1].created_at}|${items[items.length - 1].id}` : null

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

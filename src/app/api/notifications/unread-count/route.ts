import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { countUnreadAnnouncements, loadGlobalAnnouncements } from '@/lib/notifications/global-announcements'

/**
 * GET /api/notifications/unread-count
 * Retorna la cantidad de notificaciones no leídas para el usuario autenticado
 * en su organización activa. Con `?includeGlobal=1` (app móvil) suma los avisos
 * del superadmin sin leer.
 */
export const GET = withTenantAuth({}, async (request, { user, organization }) => {
  try {
    const admin = createAdminSupabase()

    const { count, error } = await admin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('organization_id', organization.id)
      .is('read_at', null)

    if (error) {
      logger.error('Failed to get unread notification count', {
        error,
        userId: user.id,
        orgId: organization.id,
      })
      return NextResponse.json({ error: 'No se pudo obtener el conteo de no leídos.' }, { status: 500 })
    }

    let globalCount = 0
    if (new URL(request.url).searchParams.get('includeGlobal') === '1') {
      const announcements = await loadGlobalAnnouncements(admin, organization.id, user.id)
      // Un fallo de los avisos no esconde el conteo de la bandeja.
      if (!announcements.error) globalCount = countUnreadAnnouncements(announcements.items)
    }

    return NextResponse.json({ count: (count ?? 0) + globalCount, globalCount })
  } catch (error) {
    logger.error('Unread count GET error', { error })
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 })
  }
})

import { NextRequest, NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import {
  NOTIFICATION_TYPES,
  type NotificationType,
} from '@/lib/notifications/types'
import {
  getAllEffectiveNotificationPreferencesForUser,
  upsertNotificationPreference,
} from '@/lib/notifications/server/preferences'
import { logger } from '@/lib/logger'

interface UpdatePreferenceBody {
  notificationType: string
  pushEnabled?: boolean
  inAppEnabled?: boolean
}

/**
 * GET /api/notifications/preferences
 * Retorna las preferencias efectivas de todos los tipos de notificación para el usuario en su organización.
 */
export const GET = withTenantAuth({}, async (_request, { user, organization }) => {
  try {
    const preferences = await getAllEffectiveNotificationPreferencesForUser(
      organization.id,
      user.id,
      organization.role
    )

    return NextResponse.json({ preferences })
  } catch (error) {
    logger.error('Failed to get notification preferences', { error, userId: user.id, orgId: organization.id })
    return NextResponse.json({ error: 'No se pudieron cargar las preferencias de notificación.' }, { status: 500 })
  }
})

/**
 * PUT /api/notifications/preferences
 * Actualiza la preferencia explícita para un tipo de evento específico.
 * user_id y organization_id son derivados estrictamente del contexto autenticado.
 */
export const PUT = withTenantAuth({}, async (request: NextRequest, { user, organization }) => {
  try {
    const body = (await request.json().catch(() => ({}))) as UpdatePreferenceBody

    if (!body.notificationType || !NOTIFICATION_TYPES.includes(body.notificationType as NotificationType)) {
      return NextResponse.json(
        { error: `Tipo de notificación inválido: ${String(body.notificationType)}` },
        { status: 400 }
      )
    }

    if (body.pushEnabled === undefined && body.inAppEnabled === undefined) {
      return NextResponse.json(
        { error: 'Se requiere especificar al menos pushEnabled o inAppEnabled.' },
        { status: 400 }
      )
    }

    const updated = await upsertNotificationPreference({
      organizationId: organization.id,
      userId: user.id,
      notificationType: body.notificationType as NotificationType,
      pushEnabled: Boolean(body.pushEnabled ?? true),
      inAppEnabled: Boolean(body.inAppEnabled ?? true),
    })

    return NextResponse.json({
      success: true,
      preference: updated,
    })
  } catch (error) {
    logger.error('Failed to update notification preference', { error, userId: user.id, orgId: organization.id })
    return NextResponse.json({ error: 'No se pudo guardar la preferencia de notificación.' }, { status: 500 })
  }
})

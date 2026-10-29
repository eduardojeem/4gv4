import { NextRequest, NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

interface UnregisterDeviceBody {
  deviceId: string
}

/**
 * POST /api/mobile/push/unregister
 * Desactiva el registro de un dispositivo push para el usuario actual al cerrar sesión.
 */
export const POST = withTenantAuth({}, async (request: NextRequest, { user, organization }) => {
  try {
    const body = (await request.json().catch(() => ({}))) as UnregisterDeviceBody

    if (!body.deviceId || typeof body.deviceId !== 'string' || body.deviceId.trim().length === 0) {
      return NextResponse.json({ error: 'deviceId es requerido.' }, { status: 400 })
    }

    const admin = createAdminSupabase()
    const cleanDeviceId = body.deviceId.trim()

    const { error } = await admin
      .from('push_devices')
      .update({
        enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', organization.id)
      .eq('user_id', user.id)
      .eq('device_id', cleanDeviceId)

    if (error) {
      logger.error('Failed to unregister push device', { error, userId: user.id, orgId: organization.id })
      return NextResponse.json({ error: 'No se pudo desactivar el dispositivo push.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Push device unregister error', { error })
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 })
  }
})

import { NextRequest, NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

interface RegisterDeviceBody {
  deviceId: string
  platform: 'ios' | 'android' | 'web'
  pushToken: string
  appVersion?: string
}

/**
 * POST /api/mobile/push/register
 * Registra o actualiza el token de notificación push del dispositivo móvil.
 * Los identificadores de usuario y organización se derivan estrictamente del token de autenticación.
 */
export const POST = withTenantAuth({}, async (request: NextRequest, { user, organization }) => {
  try {
    const body = (await request.json().catch(() => ({}))) as RegisterDeviceBody

    if (!body.deviceId || typeof body.deviceId !== 'string' || body.deviceId.trim().length === 0) {
      return NextResponse.json({ error: 'deviceId es requerido.' }, { status: 400 })
    }

    const platform = body.platform?.toLowerCase()
    if (!platform || !['ios', 'android', 'web'].includes(platform)) {
      return NextResponse.json({ error: 'platform debe ser ios, android o web.' }, { status: 400 })
    }

    if (!body.pushToken || typeof body.pushToken !== 'string' || body.pushToken.trim().length === 0) {
      return NextResponse.json({ error: 'pushToken es requerido.' }, { status: 400 })
    }

    const admin = createAdminSupabase()
    const cleanDeviceId = body.deviceId.trim()
    const cleanPushToken = body.pushToken.trim()
    const cleanAppVersion = typeof body.appVersion === 'string' ? body.appVersion.trim() : null

    // Seguridad de dispositivos compartidos:
    // Si otro usuario tenía este mismo device_id o push_token registrado previamente,
    // se desactiva para evitar que reciba notificaciones del usuario anterior tras un cambio de sesión.
    await admin
      .from('push_devices')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq('device_id', cleanDeviceId)
      .neq('user_id', user.id)

    await admin
      .from('push_devices')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq('push_token', cleanPushToken)
      .neq('user_id', user.id)

    // UPSERT del dispositivo actual para el usuario y organización autenticados
    const { data, error } = await admin
      .from('push_devices')
      .upsert(
        {
          user_id: user.id,
          organization_id: organization.id,
          device_id: cleanDeviceId,
          platform,
          push_token: cleanPushToken,
          app_version: cleanAppVersion,
          enabled: true,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,organization_id,device_id' }
      )
      .select('id, device_id, platform, enabled, app_version, last_seen_at')
      .single()

    if (error) {
      logger.error('Failed to register push device', { error, userId: user.id, orgId: organization.id })
      return NextResponse.json({ error: 'No se pudo registrar el dispositivo para notificaciones push.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      device: data,
    })
  } catch (error) {
    logger.error('Push device register error', { error })
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 })
  }
})

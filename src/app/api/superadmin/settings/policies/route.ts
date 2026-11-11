import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient, getRequestBearerToken } from '@/lib/supabase/server'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { buildMfaPath, hasVerifiedFactor, readTokenAal } from '@/lib/auth/mfa'
import { rateLimiter } from '@/lib/rate-limiter'
import {
  PASSWORD_MIN_LENGTH_RANGE,
  PLATFORM_POLICY_COLUMNS,
  invalidatePlatformPolicies,
  toPlatformPolicies,
  type PlatformPolicies,
} from '@/lib/platform/policies'
import { PLATFORM_SETTINGS_CODES } from '@/lib/superadmin/platform-settings'

/**
 * Políticas globales que la plataforma aplica de verdad (ver
 * `src/lib/platform/policies.ts`): mantenimiento, registro de empresas, 2FA
 * para los administradores de todas las tiendas y largo mínimo de contraseña.
 * Solo superadmin con la sesión verificada en dos pasos.
 */
const PoliciesSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  allowRegistration: z.boolean().optional(),
  requireTwoFactor: z.boolean().optional(),
  passwordMinLength: z.number().int()
    .min(PASSWORD_MIN_LENGTH_RANGE.min, `El mínimo es ${PASSWORD_MIN_LENGTH_RANGE.min} caracteres`)
    .max(PASSWORD_MIN_LENGTH_RANGE.max, `El máximo es ${PASSWORD_MIN_LENGTH_RANGE.max} caracteres`)
    .optional(),
}).strict()

const COLUMN: Record<keyof PlatformPolicies, string> = {
  maintenanceMode: 'maintenance_mode',
  allowRegistration: 'allow_registration',
  requireTwoFactor: 'require_two_factor',
  passwordMinLength: 'password_min_length',
}

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status })
}

export async function PUT(request: NextRequest) {
  const me = await getSuperAdminUser()
  if (!me) return json(403, { success: false, error: 'Acceso denegado.' })

  const supabase = await createClient()
  const token = (await getRequestBearerToken()) ?? (await supabase.auth.getSession()).data.session?.access_token
  if (readTokenAal(token) !== 'aal2') {
    const { data } = await supabase.auth.getUser()
    const hasFactor = hasVerifiedFactor(data.user)
    return json(403, {
      success: false,
      code: PLATFORM_SETTINGS_CODES.mfaRequired,
      error: hasFactor
        ? 'Para cambiar las políticas confirmá tu sesión con el código de la app autenticadora.'
        : 'Para cambiar las políticas activá la verificación en dos pasos en tu cuenta.',
      mfaPath: buildMfaPath('/superadmin/settings', { setup: !hasFactor }),
    })
  }

  if (!(await rateLimiter.check(`superadmin-policies:${me.id}`, 20, 60_000))) {
    return json(429, { success: false, error: 'Demasiadas solicitudes. Probá de nuevo en un minuto.' })
  }

  const parsed = PoliciesSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json(400, { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' })
  const changes = parsed.data
  const keys = Object.keys(changes) as Array<keyof PlatformPolicies>
  if (keys.length === 0) return json(400, { success: false, error: 'No hay cambios para guardar.' })

  const admin = createAdminSupabase()
  const { data: currentRow } = await admin.from('system_settings').select(PLATFORM_POLICY_COLUMNS).eq('id', 'system').maybeSingle()
  const before = toPlatformPolicies(currentRow as Parameters<typeof toPlatformPolicies>[0])

  const patch: Record<string, unknown> = { updated_by: me.id }
  for (const key of keys) patch[COLUMN[key]] = changes[key]
  const { data, error } = currentRow
    ? await admin.from('system_settings').update(patch).eq('id', 'system').select(`${PLATFORM_POLICY_COLUMNS}, updated_at`).maybeSingle()
    : await admin.from('system_settings').insert({ id: 'system', ...patch }).select(`${PLATFORM_POLICY_COLUMNS}, updated_at`).maybeSingle()
  if (error || !data) {
    console.error('Failed to update platform policies', error)
    return json(500, { success: false, error: 'No se pudieron guardar las políticas.' })
  }
  invalidatePlatformPolicies()

  await logSuperAdminAction({
    actorId: me.id,
    actorEmail: me.email,
    action: 'update_platform_policies',
    resource: 'system_settings',
    resourceId: 'system',
    oldValues: Object.fromEntries(keys.map((key) => [key, before[key]])),
    newValues: changes,
    request,
    severity: changes.maintenanceMode !== undefined || changes.requireTwoFactor !== undefined ? 'critical' : 'high',
  })

  // `updated_at` cambia: la pantalla lo usa como revisión del formulario de valores por defecto.
  const saved = data as Parameters<typeof toPlatformPolicies>[0] & { updated_at?: string | null }
  return json(200, { success: true, data: { policies: toPlatformPolicies(saved), updatedAt: saved.updated_at ?? null } })
}

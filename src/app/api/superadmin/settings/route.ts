import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient, getRequestBearerToken } from '@/lib/supabase/server'
import { getSuperAdminUser } from '@/lib/superadmin/auth'
import { logSuperAdminAction } from '@/lib/superadmin/audit'
import { buildMfaPath, hasVerifiedFactor, readTokenAal, type AssuranceLevel } from '@/lib/auth/mfa'
import { rateLimiter } from '@/lib/rate-limiter'
import {
  PLATFORM_DEFAULTS_KEYS,
  PlatformDefaultsUpdateSchema,
  mapSettingsToDB,
  type PlatformDefaultsUpdate,
} from '@/lib/validations/system-settings'
import {
  PLATFORM_SETTINGS_CODES,
  PLATFORM_SETTINGS_CONFLICT_MESSAGE,
  PLATFORM_SETTINGS_SELECT,
  describeSettingsConstraintError,
  toPlatformDefaults,
} from '@/lib/superadmin/platform-settings'

/**
 * Escritura de la configuración GLOBAL de la plataforma (`system_settings`
 * id='system'), solo para superadmin. Antes vivía como una rama de
 * /api/admin/system/settings (sin `scope`), que aceptaba cualquier clave del
 * esquema completo y no pedía la verificación en dos pasos.
 */

const RATE_LIMIT = 20
const RATE_LIMIT_WINDOW = 60 * 1000

const BodySchema = z.object({
  settings: z.unknown(),
  /** `updated_at` que la pantalla cargó: si la fila cambió desde entonces, 409. */
  revision: z.string().min(1).nullable(),
  confirmTaxRateChange: z.boolean().optional(),
}).strict()

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status })
}

async function readSessionAal(): Promise<{ aal: AssuranceLevel | null; hasFactor: boolean }> {
  try {
    const supabase = await createClient()
    const bearer = await getRequestBearerToken()
    const token = bearer ?? (await supabase.auth.getSession()).data.session?.access_token
    const aal = readTokenAal(token)
    if (aal === 'aal2') return { aal, hasFactor: true }
    const { data } = await supabase.auth.getUser()
    return { aal, hasFactor: hasVerifiedFactor(data.user) }
  } catch {
    return { aal: null, hasFactor: false }
  }
}

function validationMessage(error: z.ZodError): string {
  const issue = error.issues[0]
  if (!issue) return 'Configuración inválida'
  if (issue.code === 'unrecognized_keys') {
    return `Esta pantalla no puede cambiar: ${issue.keys.join(', ')}. Solo acepta ${PLATFORM_DEFAULTS_KEYS.join(', ')}.`
  }
  return issue.message || 'Configuración inválida'
}

export async function PUT(request: NextRequest) {
  const me = await getSuperAdminUser()
  if (!me) return json(403, { success: false, error: 'Acceso denegado.' })

  // Cambiar el IVA global afecta a todas las tiendas sin IVA propio: se exige
  // una sesión verificada en dos pasos (aal2). Cuando llegue la política de 2FA
  // obligatoria para superadmin (PR #88, `needsSuperAdminMfa` en
  // `src/lib/auth/mfa.ts`), `getSuperAdminUser()` ya lo exige para todo el
  // panel y esta comprobación pasa a ser redundante; se puede reemplazar por
  // `needsSuperAdminMfa(aal)` para respetar su salida de emergencia.
  const { aal, hasFactor } = await readSessionAal()
  if (aal !== 'aal2') {
    return json(403, {
      success: false,
      code: PLATFORM_SETTINGS_CODES.mfaRequired,
      error: hasFactor
        ? 'Para cambiar la configuración global confirmá tu sesión con el código de la app autenticadora.'
        : 'Para cambiar la configuración global activá la verificación en dos pasos en tu cuenta.',
      mfaPath: buildMfaPath('/superadmin/settings', { setup: !hasFactor }),
    })
  }

  const allowed = await rateLimiter.check(`superadmin-settings:${me.id}`, RATE_LIMIT, RATE_LIMIT_WINDOW)
  if (!allowed) return json(429, { success: false, error: 'Demasiadas solicitudes. Probá de nuevo en un minuto.' })

  const rawBody = await request.json().catch(() => null)
  const body = BodySchema.safeParse(rawBody)
  if (!body.success) {
    return json(400, { success: false, error: 'Solicitud inválida: faltan `settings` o `revision`, o hay campos de más.' })
  }

  const validation = PlatformDefaultsUpdateSchema.safeParse(body.data.settings)
  if (!validation.success) return json(400, { success: false, error: validationMessage(validation.error) })
  const settings: PlatformDefaultsUpdate = validation.data
  if (Object.keys(settings).length === 0) return json(400, { success: false, error: 'No hay cambios para guardar.' })

  const admin = createAdminSupabase()
  const { data: currentRow, error: readError } = await admin
    .from('system_settings')
    .select(PLATFORM_SETTINGS_SELECT)
    .eq('id', 'system')
    .maybeSingle()
  if (readError) {
    console.error('Failed to read global settings', readError)
    return json(500, { success: false, error: 'No se pudo leer la configuración actual.' })
  }
  const current = (currentRow ?? null) as unknown as Record<string, unknown> | null
  const revision = body.data.revision
  const currentRevision = typeof current?.updated_at === 'string' ? current.updated_at : null

  if (current && currentRevision !== revision) {
    return json(409, { success: false, code: PLATFORM_SETTINGS_CODES.conflict, error: PLATFORM_SETTINGS_CONFLICT_MESSAGE })
  }

  const before = toPlatformDefaults(current)
  if (settings.taxRate !== undefined && settings.taxRate !== before.taxRate && body.data.confirmTaxRateChange !== true) {
    return json(409, {
      success: false,
      code: PLATFORM_SETTINGS_CODES.taxRateConfirmation,
      error: 'Confirmá el cambio del IVA global: lo usan todas las tiendas que no tienen IVA propio.',
    })
  }

  const patch = { ...mapSettingsToDB(settings), updated_by: me.id, updated_at: new Date().toISOString() }

  let result: { data: unknown; error: { code?: string; message?: string; details?: string } | null }
  if (!current) {
    result = await admin.from('system_settings').insert({ id: 'system', ...patch }).select(PLATFORM_SETTINGS_SELECT)
  } else {
    let update = admin.from('system_settings').update(patch).eq('id', 'system')
    // Concurrencia optimista: solo se escribe si la fila sigue en la revisión
    // que vio la pantalla. El trigger de la tabla renueva `updated_at`.
    update = revision === null ? update.is('updated_at', null) : update.eq('updated_at', revision)
    result = await update.select(PLATFORM_SETTINGS_SELECT)
  }

  if (result.error) {
    const constraintMessage = describeSettingsConstraintError(result.error)
    if (constraintMessage) return json(400, { success: false, error: constraintMessage })
    console.error('Failed to update global system settings', result.error)
    return json(500, { success: false, error: 'No se pudo guardar la configuración global.' })
  }

  const rows = Array.isArray(result.data) ? result.data as Array<Record<string, unknown>> : []
  if (rows.length === 0) {
    return json(409, { success: false, code: PLATFORM_SETTINGS_CODES.conflict, error: PLATFORM_SETTINGS_CONFLICT_MESSAGE })
  }
  const saved = rows[0]

  const changedKeys = Object.keys(settings) as Array<keyof PlatformDefaultsUpdate>
  await logSuperAdminAction({
    actorId: me.id,
    actorEmail: me.email,
    action: 'update_system_settings',
    resource: 'system_settings',
    resourceId: 'system',
    // Sin organización a propósito: son los valores de la plataforma.
    oldValues: Object.fromEntries(changedKeys.map((key) => [key, before[key]])),
    newValues: settings,
    request,
    severity: 'high',
  })

  return json(200, {
    success: true,
    data: {
      defaults: toPlatformDefaults(saved),
      updatedAt: typeof saved.updated_at === 'string' ? saved.updated_at : null,
    },
  })
}

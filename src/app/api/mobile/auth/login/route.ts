import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimiter, getClientIp } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { createAdminSupabase } from '@/lib/supabase/admin'

/**
 * Inicio de sesión de la app móvil.
 *
 * Supabase exige el captcha de Turnstile en todo el proyecto, y Turnstile solo
 * corre en una página web: dentro de la app no se dibujaba. Supabase Auth no
 * pide el captcha cuando el pedido trae la clave de servicio, así que la app
 * manda email y contraseña acá y el servidor inicia sesión por ella.
 *
 * Lo que reemplaza al captcha es el límite de intentos: por IP y por email,
 * compartido entre instancias con Upstash. La renovación del token no pasa por
 * acá: `refresh_token` está exenta de captcha y la hace la app directo.
 *
 * La app es para el personal del comercio: un cliente de la tienda o un usuario
 * dado de baja no recibe sesión (y la que Supabase acaba de abrir se cierra).
 */

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
})

const WINDOW_MS = 15 * 60 * 1000

type StaffCheck = 'ok' | 'inactive' | 'not_staff'

async function checkStaffAccess(userId: string): Promise<StaffCheck> {
  const admin = createAdminSupabase()
  const [profile, role, memberships] = await Promise.all([
    admin.from('profiles').select('status').eq('id', userId).maybeSingle(),
    admin.from('user_roles').select('is_active').eq('user_id', userId).maybeSingle(),
    admin
      .from('organization_members')
      .select('organization_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active')
      .neq('role', 'customer'),
  ])
  if (profile.error || role.error) throw new Error('No se pudo verificar el estado del usuario')
  const status = (profile.data as { status?: string | null } | null)?.status
  const roleActive = (role.data as { is_active?: boolean | null } | null)?.is_active
  if (status === 'inactive' || status === 'suspended' || roleActive === false) return 'inactive'
  if (memberships.error) throw memberships.error
  return (memberships.count ?? 0) > 0 ? 'ok' : 'not_staff'
}

/** Cierra en Supabase la sesión que se abrió para un usuario que no puede entrar. */
async function revokeSession(url: string, serviceKey: string, accessToken: string) {
  await fetch(`${url}/auth/v1/logout?scope=local`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  }).catch(() => undefined)
}

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    logger.error('[mobile-login] Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
    return NextResponse.json({ error: 'El inicio de sesión no está disponible.' }, { status: 503 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Escribí un email y una contraseña válidos.' }, { status: 400 })
  }
  const { email, password } = parsed.data

  const ip = getClientIp(request)
  let ipAllowed: boolean
  let emailAllowed: boolean
  try {
    [ipAllowed, emailAllowed] = await Promise.all([
      rateLimiter.check(`mobile-login:ip:${ip}`, 20, WINDOW_MS, { requireShared: true }),
      rateLimiter.check(`mobile-login:email:${email}`, 8, WINDOW_MS, { requireShared: true }),
    ])
  } catch {
    logger.error('[mobile-login] Verificación de límite compartido no disponible')
    return NextResponse.json({ error: 'El inicio de sesión no está disponible temporalmente. Probá de nuevo más tarde.' }, { status: 503 })
  }
  if (!ipAllowed || !emailAllowed) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Esperá 15 minutos y volvé a probar.' },
      { status: 429 }
    )
  }

  let response: Response
  try {
    response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    })
  } catch (error) {
    logger.error('[mobile-login] No se pudo contactar a Supabase Auth', error)
    return NextResponse.json({ error: 'No se pudo conectar. Probá de nuevo.' }, { status: 502 })
  }

  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null

  if (!response.ok || !body?.access_token || !body?.refresh_token) {
    const code = String(body?.error_code ?? body?.error ?? '')
    if (code === 'email_not_confirmed') {
      return NextResponse.json({ error: 'Todavía no confirmaste tu email. Revisá tu correo.', code }, { status: 403 })
    }
    if (code === 'user_banned') {
      return NextResponse.json({ error: 'Tu usuario está suspendido.', code }, { status: 403 })
    }
    // Credenciales malas y usuario inexistente responden igual: no se revela qué emails existen.
    return NextResponse.json({ error: 'Email o contraseña incorrectos.', code: 'invalid_credentials' }, { status: 401 })
  }

  const userId = (body.user as { id?: string } | undefined)?.id
  let access: StaffCheck
  try {
    access = userId ? await checkStaffAccess(userId) : 'not_staff'
  } catch (error) {
    logger.error('[mobile-login] No se pudo verificar el acceso del usuario', error)
    await revokeSession(url, serviceKey, String(body.access_token))
    return NextResponse.json({ error: 'No se pudo verificar tu acceso. Probá de nuevo.' }, { status: 503 })
  }
  if (access !== 'ok') {
    await revokeSession(url, serviceKey, String(body.access_token))
    return NextResponse.json(
      access === 'inactive'
        ? { error: 'Tu usuario está desactivado. Pedile al dueño del comercio que lo active.', code: 'inactive' }
        : { error: 'Esta app es para el personal del comercio. Tu usuario no pertenece a ningún comercio activo.', code: 'not_staff' },
      { status: 403 }
    )
  }

  // Solo lo que la app necesita para `supabase.auth.setSession`.
  return NextResponse.json({
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_in: body.expires_in,
  })
}

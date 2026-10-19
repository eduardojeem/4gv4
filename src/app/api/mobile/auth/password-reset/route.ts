import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimiter, getClientIp } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { siteUrl } from '@/lib/site-url'

/**
 * Recuperación de contraseña desde la app móvil.
 *
 * Igual que el login: Supabase exige el captcha de Turnstile para pedir el
 * correo de recuperación y Turnstile no corre dentro de la app. El pedido sale
 * de acá con la clave de servicio, que Supabase exime del captcha, y lo que
 * frena el abuso es el límite de intentos por IP y por email.
 *
 * El enlace del correo abre la página web de restablecer contraseña, la misma
 * que usa la web. La respuesta es siempre la misma, exista o no el email, para
 * no revelar qué cuentas hay.
 */

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
})

const WINDOW_MS = 60 * 60 * 1000

const SENT = { ok: true, message: 'Si el email está registrado, te enviamos un enlace para crear una nueva contraseña.' }

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    logger.error('[mobile-password-reset] Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
    return NextResponse.json({ error: 'La recuperación de contraseña no está disponible.' }, { status: 503 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Escribí un email válido.' }, { status: 400 })
  }
  const { email } = parsed.data

  const ip = getClientIp(request)
  let ipAllowed: boolean
  let emailAllowed: boolean
  try {
    [ipAllowed, emailAllowed] = await Promise.all([
      rateLimiter.check(`mobile-reset:ip:${ip}`, 10, WINDOW_MS, { requireShared: true }),
      rateLimiter.check(`mobile-reset:email:${email}`, 3, WINDOW_MS, { requireShared: true }),
    ])
  } catch {
    logger.error('[mobile-password-reset] Verificación de límite compartido no disponible')
    return NextResponse.json({ error: 'La recuperación no está disponible temporalmente. Probá de nuevo más tarde.' }, { status: 503 })
  }
  if (!ipAllowed || !emailAllowed) {
    return NextResponse.json({ error: 'Demasiados pedidos. Esperá una hora y volvé a probar.' }, { status: 429 })
  }

  const redirectTo = encodeURIComponent(siteUrl('/auth/reset-password'))
  let response: Response
  try {
    response = await fetch(`${url}/auth/v1/recover?redirect_to=${redirectTo}`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
      cache: 'no-store',
    })
  } catch (error) {
    logger.error('[mobile-password-reset] No se pudo contactar a Supabase Auth', error)
    return NextResponse.json({ error: 'No se pudo conectar. Probá de nuevo.' }, { status: 502 })
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null
    const code = String(body?.error_code ?? body?.error ?? '')
    // Supabase limita los correos por su cuenta; eso sí se le dice al usuario.
    if (response.status === 429 || code === 'over_email_send_rate_limit') {
      return NextResponse.json({ error: 'Ya se enviaron varios correos. Esperá unos minutos y volvé a probar.' }, { status: 429 })
    }
    // Un email inexistente no debe distinguirse de uno válido.
    if (code === 'user_not_found') return NextResponse.json(SENT)
    logger.error('[mobile-password-reset] Supabase rechazó el pedido', { status: response.status, code })
    return NextResponse.json({ error: 'No se pudo enviar el correo. Probá de nuevo.' }, { status: 502 })
  }

  return NextResponse.json(SENT)
}

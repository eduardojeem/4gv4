/**
 * El enlace de «restablecer contraseña», de punta a punta.
 *
 * Supabase puede devolver a la persona a `/auth/reset-password` de cuatro
 * maneras, según quién pidió el correo y qué plantilla de email use el proyecto:
 *
 *  1. `?code=` (PKCE): lo pidió el navegador con `resetPasswordForEmail`. El
 *     código sólo se canjea con el `code_verifier` que ese mismo navegador
 *     guardó en una cookie al pedir el correo. Abierto en otro navegador, en
 *     otro dispositivo o en el navegador interno de Gmail/Outlook, no hay
 *     verificador y el código no sirve.
 *  2. `?token_hash=&type=recovery`: la plantilla del correo usa
 *     `{{ .TokenHash }}`. Se verifica con `verifyOtp` y funciona en cualquier
 *     navegador. Es la plantilla recomendada.
 *  3. `#access_token=&refresh_token=` (implícito): lo pidió el servidor (clave
 *     de servicio, app móvil, alta de cliente desde el panel).
 *  4. `?error=&error_code=otp_expired`: Supabase ya rechazó el enlace (vencido
 *     o usado) antes de redirigir.
 *
 * Antes la página sólo miraba si ya había sesión: en los casos 1 sin
 * verificador, 2 y 4 mostraba «inválido o expirado» y a los dos segundos
 * mandaba al login, sin decir qué pasó ni cómo seguir.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type RecoveryFailure =
  /** El enlace venció o ya se usó. */
  | 'expired'
  /** Enlace PKCE abierto en un navegador distinto del que pidió el correo. */
  | 'other-browser'
  /** Se entró a la página sin ningún dato de recuperación. */
  | 'missing'
  /** Cualquier otra cosa (red, Supabase caído). */
  | 'unknown'

export type RecoveryResult =
  | { ok: true; email: string | null }
  | { ok: false; reason: RecoveryFailure }

export interface RecoveryUrlParams {
  code: string | null
  tokenHash: string | null
  type: string | null
  accessToken: string | null
  refreshToken: string | null
  errorCode: string | null
  errorDescription: string | null
}

/** Lee los datos de recuperación de la query y del hash (el hash gana). */
export function readRecoveryParams(href: string): RecoveryUrlParams {
  const url = new URL(href, 'http://localhost')
  const hash = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash)
  const pick = (key: string) => hash.get(key) || url.searchParams.get(key) || null
  return {
    code: url.searchParams.get('code') || null,
    tokenHash: pick('token_hash'),
    type: pick('type'),
    accessToken: hash.get('access_token') || null,
    refreshToken: hash.get('refresh_token') || null,
    errorCode: pick('error_code') ?? pick('error'),
    errorDescription: pick('error_description'),
  }
}

type ErrorLike = { name?: string; code?: string; message?: string } | null | undefined

/** Traduce el error de Supabase a una causa que la persona pueda entender. */
export function classifyRecoveryError(error: ErrorLike): RecoveryFailure {
  if (!error) return 'unknown'
  const code = String(error.code ?? '').toLowerCase()
  const name = String(error.name ?? '')
  const message = String(error.message ?? '')

  if (
    name === 'AuthPKCECodeVerifierMissingError' ||
    code === 'pkce_code_verifier_not_found' ||
    code === 'bad_code_verifier' ||
    /code verifier/i.test(message)
  ) {
    return 'other-browser'
  }

  if (
    ['otp_expired', 'flow_state_expired', 'flow_state_not_found', 'access_denied', 'invalid_grant'].includes(code) ||
    /expired|invalid|already (been )?used|not found|has been used/i.test(message)
  ) {
    return 'expired'
  }

  return 'unknown'
}

/** Quita de la barra de direcciones los datos de un solo uso del enlace. */
export function stripRecoveryParams(href: string): string {
  const url = new URL(href)
  for (const key of ['code', 'token_hash', 'type', 'error', 'error_code', 'error_description', 'sb_flow_id']) {
    url.searchParams.delete(key)
  }
  url.hash = ''
  return `${url.pathname}${url.search}`
}

type RecoveryAuthClient = Pick<
  SupabaseClient['auth'],
  'initialize' | 'getSession' | 'verifyOtp' | 'setSession'
>

/**
 * Deja establecida la sesión de recuperación a partir del enlace del correo,
 * o explica por qué no se puede.
 *
 * El cliente del navegador (`@supabase/ssr`) ya intenta canjear `?code=` al
 * iniciarse (`detectSessionInUrl`); `initialize()` devuelve el resultado de
 * ese intento, así que no se vuelve a canjear (el código es de un solo uso).
 *
 * Una sesión que el navegador ya tenía (la persona estaba logueada) NO cuenta
 * como sesión de recuperación cuando el enlace trae datos: primero se usa el
 * enlace y, si falla, se dice por qué. Antes se aceptaba esa sesión vieja y
 * Supabase rechazaba el cambio con `reauthentication_needed`.
 *
 * `readHref` lee la URL después de `initialize()`: el SDK borra `?code=` sólo
 * cuando lo canjeó, así que si sigue ahí, el canje no ocurrió.
 */
export async function establishRecoverySession(
  auth: RecoveryAuthClient,
  href: string,
  readHref: () => string = () => href
): Promise<RecoveryResult> {
  const params = readRecoveryParams(href)

  // 4) Supabase ya rechazó el enlace antes de redirigir.
  if (params.errorCode || params.errorDescription) {
    const reason = classifyRecoveryError({ code: params.errorCode ?? undefined, message: params.errorDescription ?? undefined })
    return { ok: false, reason: reason === 'unknown' ? 'expired' : reason }
  }

  let initError: ErrorLike = null
  try {
    initError = (await auth.initialize())?.error ?? null
  } catch (error) {
    initError = error as ErrorLike
  }

  // 1) PKCE: si el SDK intentó canjear y falló, ese es el motivo real. Si el
  // código sigue en la URL sin error, en este navegador no hay `code_verifier`
  // y el SDK ni lo intentó (canjearlo a mano daría el mismo error).
  if (params.code) {
    if (initError) return { ok: false, reason: classifyRecoveryError(initError) }
    if (readRecoveryParams(readHref()).code) return { ok: false, reason: 'other-browser' }
  }

  // 2) token_hash: funciona en cualquier navegador.
  if (params.tokenHash) {
    if (params.type && params.type !== 'recovery') return { ok: false, reason: 'expired' }
    const { data, error } = await auth.verifyOtp({ token_hash: params.tokenHash, type: 'recovery' })
    if (error || !data.session) return { ok: false, reason: error ? classifyRecoveryError(error) : 'expired' }
    return { ok: true, email: data.session.user?.email ?? data.user?.email ?? null }
  }

  // 3) Implícito: tokens en el hash.
  if (params.accessToken && params.refreshToken) {
    const { data, error } = await auth.setSession({
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
    })
    if (error || !data.session) return { ok: false, reason: 'expired' }
    return { ok: true, email: data.session.user?.email ?? null }
  }

  // PKCE ya canjeado por el SDK, o se entró sin enlace con la sesión abierta
  // (en ese caso Supabase puede pedir un código: ver `reauth`).
  const { data: { session } } = await auth.getSession()
  if (session) return { ok: true, email: session.user?.email ?? null }

  if (params.code) return { ok: false, reason: 'other-browser' }
  return { ok: false, reason: 'missing' }
}

export interface RecoveryFailureCopy {
  title: string
  description: string
  hint?: string
}

export const RECOVERY_FAILURE_COPY: Record<RecoveryFailure, RecoveryFailureCopy> = {
  expired: {
    title: 'El enlace venció o ya se usó',
    description: 'Por seguridad, cada enlace sirve una sola vez y dura poco tiempo.',
    hint: 'Pedí uno nuevo y usalo apenas te llegue. Si recibiste varios correos, abrí solamente el último.',
  },
  'other-browser': {
    title: 'Abrí el enlace en el mismo navegador',
    description:
      'Este enlace sólo funciona en el navegador donde pediste el cambio de contraseña. Parece que lo abriste en otro navegador, en otro dispositivo o dentro de la app de correo.',
    hint: 'Copiá el enlace y pegalo en el navegador donde lo pediste, o pedí uno nuevo desde este navegador.',
  },
  missing: {
    title: 'Falta el enlace de recuperación',
    description: 'Para crear una contraseña nueva tenés que entrar desde el enlace que te enviamos por correo.',
    hint: 'Si no lo encontrás, revisá la carpeta de spam o pedí uno nuevo.',
  },
  unknown: {
    title: 'No pudimos validar el enlace',
    description: 'Hubo un problema al conectar con el servidor.',
    hint: 'Revisá tu conexión y volvé a abrir el enlace. Si sigue fallando, pedí uno nuevo.',
  },
}

export type PasswordUpdateErrorKind = 'session' | 'reauth' | 'bad-nonce' | 'same-password' | 'weak' | 'mfa' | 'rate-limit' | 'network' | 'unknown'

export interface PasswordUpdateError {
  kind: PasswordUpdateErrorKind
  message: string
}

/** Los errores de `updateUser({ password })`, con qué hacer después. */
export function describePasswordUpdateError(error: ErrorLike): PasswordUpdateError {
  const code = String(error?.code ?? '').toLowerCase()
  const name = String(error?.name ?? '')
  const message = String(error?.message ?? '')

  if (
    name === 'AuthSessionMissingError' ||
    ['session_not_found', 'session_expired', 'refresh_token_not_found', 'bad_jwt', 'no_authorization'].includes(code) ||
    /session missing|session.*(expired|not found)|jwt expired|invalid jwt|not authenticated/i.test(message)
  ) {
    return {
      kind: 'session',
      message: 'Tu enlace de recuperación venció mientras completabas el formulario. Pedí uno nuevo para terminar.',
    }
  }
  // «Cambio de contraseña seguro»: la sesión no es reciente y hace falta el
  // código de 6 dígitos que manda `reauthenticate()`.
  if (code === 'reauthentication_needed' || /requires reauthentication/i.test(message)) {
    return { kind: 'reauth', message: 'Por seguridad, confirmá el código que te enviamos por correo.' }
  }
  if (code === 'reauthentication_not_valid' || /invalid nonce|nonce has expired/i.test(message)) {
    return { kind: 'bad-nonce', message: 'El código no es correcto o venció. Revisalo o pedí uno nuevo.' }
  }
  if (code === 'same_password' || /different from the old password/i.test(message)) {
    return { kind: 'same-password', message: 'La nueva contraseña tiene que ser distinta de la que tenías.' }
  }
  if (code === 'insufficient_aal' || /aal2/i.test(message)) {
    return { kind: 'mfa', message: 'Antes de cambiarla tenés que confirmar el código de verificación en dos pasos.' }
  }
  if (code === 'weak_password' || /known to be weak|easy to guess|compromised|breached|pwned/i.test(message)) {
    return {
      kind: 'weak',
      message: 'Esa contraseña aparece en filtraciones o es fácil de adivinar. Elegí una más larga y única, que no uses en otras cuentas.',
    }
  }
  if (/password should be|password is too short|weak.?password|at least \d+ characters/i.test(message)) {
    return { kind: 'weak', message: 'La contraseña no cumple los requisitos de seguridad. Revisá la lista de abajo.' }
  }
  if (code === 'over_request_rate_limit' || /rate limit|too many requests|for security purposes/i.test(message)) {
    return { kind: 'rate-limit', message: 'Hiciste varios intentos seguidos. Esperá un minuto y volvé a probar.' }
  }
  if (/failed to fetch|network|timeout/i.test(message)) {
    return { kind: 'network', message: 'No se pudo conectar con el servidor. Comprobá tu conexión a internet.' }
  }
  return { kind: 'unknown', message: 'No pudimos cambiar tu contraseña. Intentá de nuevo.' }
}

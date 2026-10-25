/**
 * Passkeys (WebAuthn: huella, Face ID, Windows Hello) sobre la API nativa de
 * Supabase Auth (`signInWithPasskey`, `registerPasskey`, `auth.passkey.*`).
 *
 * Supabase guarda las credenciales, los challenges (vencen a los 5 minutos) y
 * los contadores en su propio esquema `auth`, y crea la sesión al verificar.
 * Acá sólo queda detectar soporte del navegador y traducir los errores.
 * Ver docs/passkeys.md para la configuración del proyecto y el RP ID.
 */

export function browserSupportsPasskeys(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean(
    window.PublicKeyCredential &&
      typeof navigator !== 'undefined' &&
      typeof navigator.credentials?.create === 'function' &&
      typeof navigator.credentials?.get === 'function'
  )
}

type ErrorLike = { code?: unknown; name?: unknown; message?: unknown; cause?: unknown }

function readCode(error: unknown): string {
  if (!error || typeof error !== 'object') return ''
  const { code } = error as ErrorLike
  return typeof code === 'string' ? code : ''
}

function readName(error: unknown): string {
  if (!error || typeof error !== 'object') return ''
  const { name, cause } = error as ErrorLike
  // Los errores del navegador (DOMException) llegan envueltos en `cause`.
  if (cause && typeof cause === 'object' && typeof (cause as ErrorLike).name === 'string') {
    return (cause as ErrorLike).name as string
  }
  return typeof name === 'string' ? name : ''
}

/** La persona cerró o canceló el diálogo del sistema: no es un error que mostrar. */
export function isPasskeyCancellation(error: unknown): boolean {
  const code = readCode(error)
  const name = readName(error)
  return code === 'ERROR_CEREMONY_ABORTED' || name === 'NotAllowedError' || name === 'AbortError'
}

const MESSAGES: Record<string, string> = {
  passkey_disabled: 'El ingreso con huella o Face ID no está habilitado todavía. Usá tu contraseña.',
  webauthn_credential_not_found:
    'Esta passkey no está registrada en ninguna cuenta. Ingresá con tu contraseña y registrala desde tu perfil.',
  webauthn_challenge_expired: 'La solicitud venció. Intentá de nuevo.',
  webauthn_challenge_not_found: 'La solicitud venció o ya se usó. Intentá de nuevo.',
  webauthn_verification_failed: 'No pudimos verificar la passkey. Intentá de nuevo o usá tu contraseña.',
  webauthn_credential_exists: 'Este dispositivo ya está registrado en tu cuenta.',
  too_many_passkeys: 'Llegaste al máximo de passkeys. Borrá alguna que no uses para agregar otra.',
  email_not_confirmed: 'Tu cuenta aún no fue confirmada. Revisá tu correo.',
  user_banned: 'Esta cuenta está suspendida.',
  captcha_failed: 'Completá la verificación de seguridad e intentá de nuevo.',
  over_request_rate_limit: 'Demasiados intentos. Esperá unos minutos antes de volver a intentar.',
  ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED: 'Este dispositivo ya está registrado en tu cuenta.',
  ERROR_INVALID_DOMAIN: 'Las passkeys no están disponibles en este dominio.',
  ERROR_INVALID_RP_ID: 'Las passkeys no están disponibles en este dominio.',
}

/** Mensaje en castellano para un error de Supabase Auth o de la ceremonia WebAuthn. */
export function describePasskeyError(error: unknown): string {
  const code = readCode(error)
  if (code && MESSAGES[code]) return MESSAGES[code]
  if (readName(error) === 'SecurityError') return MESSAGES.ERROR_INVALID_DOMAIN
  const message = error && typeof error === 'object' ? (error as ErrorLike).message : undefined
  if (typeof message === 'string' && /captcha/i.test(message)) return MESSAGES.captcha_failed
  if (typeof message === 'string' && /Failed to fetch|NetworkError/i.test(message)) {
    return 'No se pudo conectar con el servidor. Verificá tu conexión a internet.'
  }
  return 'No se pudo completar el ingreso con passkey. Intentá de nuevo o usá tu contraseña.'
}

/** Nombre sugerido para la passkey del dispositivo actual (editable después). */
export function defaultPasskeyLabel(userAgent: string): string {
  const ua = userAgent || ''
  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Mac OS X|Macintosh/.test(ua)
            ? 'Mac'
            : /Linux/.test(ua)
              ? 'Linux'
              : ''
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : ''
  const label = [os, browser].filter(Boolean).join(' · ')
  return label || 'Este dispositivo'
}

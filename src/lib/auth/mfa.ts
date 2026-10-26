/**
 * Verificación en dos pasos (2FA) con el MFA nativo de Supabase Auth (TOTP).
 *
 * Supabase guarda los factores en su esquema `auth` y marca cada token con el
 * nivel de verificación de la sesión (`aal`): `aal1` es sólo contraseña o
 * passkey, `aal2` ya pasó el código de la app autenticadora. Acá vive la regla
 * que comparten el proxy, las APIs y las pantallas: quien tiene un factor
 * verificado necesita una sesión `aal2`.
 *
 * Sin dependencias de red ni de Next para poder usarla en el proxy, en el
 * servidor y en el navegador, y ejercitarla en tests.
 */

export type AssuranceLevel = 'aal1' | 'aal2'

/** Código de las respuestas 401 cuando falta el segundo paso. */
export const MFA_REQUIRED_CODE = 'MFA_REQUIRED'
/** Código de las respuestas 403 cuando la organización exige 2FA y el administrador no la activó. */
export const MFA_ENROLLMENT_REQUIRED_CODE = 'MFA_ENROLLMENT_REQUIRED'
/** `code` del AuthError que devuelve `getUser()` en el servidor cuando falta el segundo paso. */
export const MFA_REQUIRED_AUTH_ERROR = 'mfa_required'

/** Página donde se pide el código (y donde se activa cuando la organización lo exige). */
export const MFA_PAGE_PATH = '/auth/mfa'

/** Roles de organización a los que alcanza «exigir 2FA a los administradores». */
const ADMIN_MFA_ROLES = new Set(['owner', 'admin'])

type FactorLike = { status?: string | null; factor_type?: string | null }
type UserWithFactors = { factors?: FactorLike[] | null } | null | undefined

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  return atob(padded)
}

/**
 * Nivel de verificación (`aal`) que dice el token. No valida la firma: sólo se
 * usa con un token que Supabase Auth acaba de aceptar en `getUser(token)`.
 */
export function readTokenAal(token: string | null | undefined): AssuranceLevel | null {
  if (!token) return null
  const payload = token.split('.')[1]
  if (!payload) return null
  try {
    const { aal } = JSON.parse(decodeBase64Url(payload)) as { aal?: unknown }
    return aal === 'aal1' || aal === 'aal2' ? aal : null
  } catch {
    return null
  }
}

/** Un factor sin verificar es una activación que quedó a medias: no cuenta. */
export function hasVerifiedFactor(user: UserWithFactors): boolean {
  return Boolean(user?.factors?.some((factor) => factor.status === 'verified'))
}

/** Tiene 2FA activa y esta sesión todavía no pasó el código. */
export function isMfaPending(user: UserWithFactors, aal: AssuranceLevel | null): boolean {
  return hasVerifiedFactor(user) && aal !== 'aal2'
}

export function isAdminMfaRole(organizationRole: string | null | undefined): boolean {
  return Boolean(organizationRole && ADMIN_MFA_ROLES.has(organizationRole))
}

/**
 * La organización exige 2FA a sus administradores y esta sesión no la tiene.
 * Si la persona ya tiene un factor verificado, el caso lo cubre `isMfaPending`
 * (le falta el código, no activarla).
 */
export function needsAdminMfaEnrollment(input: {
  organizationRole: string | null | undefined
  requireAdminMfa: boolean
  aal: AssuranceLevel | null
}): boolean {
  return input.requireAdminMfa && isAdminMfaRole(input.organizationRole) && input.aal !== 'aal2'
}

/** `/auth/mfa?redirect=…` (con `setup=1` cuando tiene que activarla). */
export function buildMfaPath(redirect: string | null | undefined, options: { setup?: boolean } = {}): string {
  const params = new URLSearchParams()
  if (options.setup) params.set('setup', '1')
  if (redirect && redirect !== MFA_PAGE_PATH) params.set('redirect', redirect)
  const query = params.toString()
  return query ? `${MFA_PAGE_PATH}?${query}` : MFA_PAGE_PATH
}

/** Deja sólo los dígitos: las apps muestran el código como «123 456». */
export function normalizeTotpCode(input: string): string {
  return input.replace(/\D/g, '').slice(0, 6)
}

export function isCompleteTotpCode(code: string): boolean {
  return /^\d{6}$/.test(code)
}

type ErrorLike = { code?: unknown; message?: unknown; status?: unknown }

const MFA_MESSAGES: Record<string, string> = {
  mfa_verification_failed: 'El código no es correcto. Revisá la hora del teléfono y probá con el código nuevo.',
  mfa_challenge_expired: 'El código venció. Escribí el que muestra ahora la app.',
  mfa_factor_not_found: 'No encontramos ese método de verificación. Volvé a cargar la página.',
  mfa_factor_name_conflict: 'Ya tenés una app autenticadora con ese nombre.',
  mfa_totp_enroll_not_enabled: 'La verificación en dos pasos no está habilitada en el sistema todavía.',
  mfa_totp_verify_not_enabled: 'La verificación en dos pasos no está habilitada en el sistema todavía.',
  too_many_enrolled_mfa_factors: 'Llegaste al máximo de métodos de verificación. Borrá alguno para agregar otro.',
  insufficient_aal: 'Por seguridad, primero confirmá tu sesión con el código de la app autenticadora.',
  over_request_rate_limit: 'Demasiados intentos. Esperá unos minutos antes de volver a probar.',
  session_not_found: 'Tu sesión venció. Volvé a iniciar sesión.',
}

/** Mensaje en castellano para un error de `supabase.auth.mfa.*`. */
export function describeMfaError(error: unknown): string {
  if (error && typeof error === 'object') {
    const { code, message } = error as ErrorLike
    if (typeof code === 'string' && MFA_MESSAGES[code]) return MFA_MESSAGES[code]
    if (typeof message === 'string') {
      if (/invalid totp code|verification failed/i.test(message)) return MFA_MESSAGES.mfa_verification_failed
      if (/expired/i.test(message)) return MFA_MESSAGES.mfa_challenge_expired
      if (/AAL2 required|insufficient/i.test(message)) return MFA_MESSAGES.insufficient_aal
      if (/Failed to fetch|NetworkError/i.test(message)) {
        return 'No se pudo conectar con el servidor. Verificá tu conexión a internet.'
      }
    }
  }
  return 'No se pudo completar la verificación en dos pasos. Intentá de nuevo.'
}

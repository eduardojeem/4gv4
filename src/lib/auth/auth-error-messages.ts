/**
 * Los errores de Supabase, en castellano y con voseo.
 *
 * Supabase contesta en inglés y en su propio vocabulario: «User already
 * registered», «For security purposes, you can only request this after 31
 * seconds», «captcha protection: request disallowed». En la pantalla de una
 * tienda eso es una pared: el cliente no sabe si se equivocó, si falló el
 * sistema, ni qué hacer después.
 *
 * Cada mensaje dice qué pasó y cuál es el próximo paso. El texto original se
 * guarda en el log, no se le muestra a nadie.
 */

export type AuthFlow = 'login' | 'register'

const MENSAJE_GENERICO: Record<AuthFlow, string> = {
  login: 'El correo o la contraseña no coinciden con una cuenta activa.',
  register: 'No pudimos crear tu cuenta. Revisá los datos e intentá de nuevo.',
}

type Regla = { patron: RegExp; login?: string; register?: string }

const REGLAS: Regla[] = [
  {
    patron: /user already registered|already been registered|email address is already/i,
    register:
      'Ese correo ya tiene una cuenta. Iniciá sesión y desde ahí te vinculamos con esta tienda.',
  },
  {
    patron: /invalid login credentials|invalid_grant/i,
    login: 'El correo o la contraseña no son correctos. Verificá los datos e intentá de nuevo.',
  },
  {
    patron: /email not confirmed/i,
    login: 'Tu cuenta aún no fue confirmada. Revisá tu casilla de correo o spam.',
    register: 'Tu cuenta aún no fue confirmada. Revisá tu casilla de correo o spam.',
  },
  {
    patron: /invalid email|email address.*invalid/i,
    login: 'Revisá el correo: parece que tiene un error de tipeo.',
    register: 'Revisá el correo: parece que tiene un error de tipeo.',
  },
  {
    patron: /password should be|password is too short|weak.?password/i,
    register: 'La contraseña es demasiado corta o insegura. Usá al menos 8 caracteres, con mayúscula, minúscula y número.',
  },
  {
    patron: /captcha/i,
    login: 'No pudimos validar la verificación de seguridad. Volvé a marcarla e intentá de nuevo.',
    register: 'No pudimos validar la verificación de seguridad. Volvé a marcarla e intentá de nuevo.',
  },
  {
    // «For security purposes, you can only request this after N seconds».
    patron: /rate limit|too many requests|for security purposes|only request this after/i,
    login: 'Demasiados intentos. Esperá unos instantes antes de volver a intentar.',
    register: 'Hiciste varios intentos seguidos. Esperá un minuto y volvé a probar.',
  },
  {
    patron: /signups? not allowed|disabled/i,
    register: 'La tienda tiene el registro de clientes cerrado por ahora. Escribinos y te damos una mano.',
  },
  {
    patron: /failed to fetch|network|timeout/i,
    login: 'No se pudo conectar con el servidor. Comprobá tu conexión a internet.',
    register: 'No se pudo conectar con el servidor. Comprobá tu conexión a internet.',
  },
]

/** El mensaje que se le muestra a la persona. Nunca devuelve el texto original. */
export function describeAuthError(mensajeOriginal: string | null | undefined, flujo: AuthFlow): string {
  const texto = (mensajeOriginal ?? '').trim()
  if (!texto) return MENSAJE_GENERICO[flujo]

  for (const regla of REGLAS) {
    if (!regla.patron.test(texto)) continue
    const mensaje = regla[flujo]
    if (mensaje) return mensaje
  }

  return MENSAJE_GENERICO[flujo]
}

/**
 * Supabase no dice «ese correo ya existe» cuando hay confirmación por mail:
 * para que nadie pueda averiguar quién tiene cuenta, devuelve un usuario con
 * la lista de identidades vacía. Sin mirar eso, el registro parece haber
 * salido bien y la persona espera un correo que nunca llega.
 */
export function signUpFoundExistingAccount(user: { identities?: unknown[] | null } | null | undefined): boolean {
  return Array.isArray(user?.identities) && user.identities.length === 0
}

export const EMAIL_YA_REGISTRADO =
  'Ese correo ya tiene una cuenta. Iniciá sesión y desde ahí te vinculamos con esta tienda.'

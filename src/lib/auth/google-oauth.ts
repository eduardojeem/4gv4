/**
 * Arma la URL a la que Google (vía Supabase) devuelve a la persona. Pasa por
 * `/auth/callback`, que canjea el código por la sesión y sigue a `next`.
 * `next` siempre es una ruta interna: cualquier otra cosa vuelve al panel.
 */
export function buildGoogleCallbackUrl(origin: string, next: string): string {
  const safeNext = isInternalPath(next) ? next : '/dashboard'
  return `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`
}

function isInternalPath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')
}

/**
 * Google o Supabase devuelven `?error=` cuando la persona cancela o el
 * proveedor falla. El mensaje sale para mostrarlo en el login.
 */
export function describeOAuthCallbackError(error: string | null, description: string | null): string {
  if (error === 'access_denied') return 'Cancelaste el ingreso con Google. Podés intentarlo de nuevo o entrar con tu correo.'
  if (description && /email/i.test(description) && /(exist|registered|already)/i.test(description)) {
    return 'Ese correo ya tiene una cuenta. Entrá con tu contraseña.'
  }
  return 'No se pudo completar el ingreso con Google. Probá de nuevo o entrá con tu correo.'
}

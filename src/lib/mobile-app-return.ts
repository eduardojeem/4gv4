/**
 * Volver a la app después de registrarse. La app abre /register con
 * `app_return=<su dirección>`; al terminar, la web vuelve ahí en vez de quedarse
 * en el navegador. Solo se acepta el esquema de la app (el de mobile/app.json):
 * cualquier otra dirección se ignora, así el registro no sirve para mandar a la
 * gente a otro sitio. En desarrollo también vale Expo Go (exp://).
 */
export const MOBILE_APP_SCHEME = 'mitiendapy'

const DEV_SCHEMES = new Set(['exp:', 'exps:'])

export function safeAppReturnUrl(raw: string | null | undefined, nodeEnv: string | undefined = process.env.NODE_ENV): string | null {
  if (!raw || raw.length > 300) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol === `${MOBILE_APP_SCHEME}:`) return url.toString()
  if (nodeEnv !== 'production' && DEV_SCHEMES.has(url.protocol)) return url.toString()
  return null
}

/** La dirección de vuelta con el resultado: cuenta creada y si falta confirmar el email. */
export function appReturnWithResult(returnUrl: string, result: { requiresEmailConfirmation: boolean }): string {
  const url = new URL(returnUrl)
  url.searchParams.set('registered', '1')
  if (result.requiresEmailConfirmation) url.searchParams.set('confirmar', '1')
  else url.searchParams.delete('confirmar')
  return url.toString()
}

/**
 * La dirección de vuelta con el token del captcha: el registro nativo de la app
 * lo pide a /auth/captcha-app (Cloudflare no tiene versión para la app).
 */
export function appReturnWithCaptcha(returnUrl: string, token: string): string {
  const url = new URL(returnUrl)
  url.searchParams.set('captcha', token)
  return url.toString()
}

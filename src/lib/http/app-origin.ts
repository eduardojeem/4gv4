/**
 * Origen tal como lo ve el navegador. request.url refleja la dirección en la
 * que escucha el servidor (en dev, 0.0.0.0), que no sirve como URL de retorno.
 */
export function getBrowserRequestOrigin(request: Request) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  if (!host) return new URL(request.url).origin
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
    || new URL(request.url).protocol.replace(':', '')
  return `${proto}://${host}`
}

/**
 * Origen absoluto para las URLs de retorno de los proveedores de pago. En desarrollo manda el
 * origen del request: .env.local suele apuntar al dominio de producción.
 */
export function getAppReturnOrigin(requestOrigin?: string | null) {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL
  const origin = process.env.NODE_ENV === 'production'
    ? configured || requestOrigin || 'http://localhost:3000'
    : requestOrigin || configured || 'http://localhost:3000'
  return origin.replace(/\/+$/, '')
}

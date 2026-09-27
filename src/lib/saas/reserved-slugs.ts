import { slugifyTenantName } from './tenant'

/**
 * Que puede ser el subdominio de una tienda, y que no.
 *
 * La plataforma resuelve la tienda de dos formas: por subdominio
 * (`mitienda.dominio.com`) y por ruta (`/mitienda/inicio`). Eso hace que un
 * nombre de empresa cualquiera pueda chocar contra infraestructura o contra una
 * pantalla del propio sistema: una empresa llamada "Marketplace" producia el
 * slug `marketplace`, que como ruta ya es el marketplace publico, y una llamada
 * "App" producia `app`, que suele ser un subdominio de servicio.
 *
 * Antes no habia ninguna lista: el unico limite era que el slug no estuviera
 * tomado por otra tienda.
 */

/**
 * Rutas de primer nivel del proyecto. Una tienda con uno de estos slugs queda
 * tapada por la pantalla del sistema y su tienda es inalcanzable por ruta.
 *
 * La prueba `reserved-slugs.test.ts` compara esta lista contra las carpetas
 * reales de `src/app`, asi que agregar una pantalla nueva sin sumarla aca hace
 * fallar la suite en vez de aparecer como un bug de un cliente meses despues.
 */
export const APP_ROUTE_SLUGS = [
  'admin', 'api', 'auth', 'carrito', 'cliente', 'dashboard', 'debug',
  'empresas', 'forbidden', 'inicio', 'login', 'marketplace', 'mis-reparaciones',
  'ofertas', 'perfil', 'productos', 'products', 'register', 'saas', 'servicios',
  'setup', 'setup-access', 'superadmin', 'track',
] as const

/** Subdominios que suele usar la infraestructura de un dominio. */
export const INFRA_SLUGS = [
  'www', 'mail', 'smtp', 'imap', 'pop', 'webmail', 'autodiscover', 'mx',
  'ns', 'ns1', 'ns2', 'dns', 'ftp', 'sftp', 'ssh', 'vpn',
  'cdn', 'static', 'assets', 'img', 'images', 'media', 'files', 'uploads',
  'app', 'apps', 'web', 'dev', 'test', 'staging', 'demo', 'preview', 'beta',
  'blog', 'docs', 'help', 'support', 'status', 'mailer', 'billing', 'pay',
] as const

export const RESERVED_TENANT_SLUGS: ReadonlySet<string> = new Set<string>([
  ...APP_ROUTE_SLUGS,
  ...INFRA_SLUGS,
])

export const TENANT_SLUG_MIN_LENGTH = 3
export const TENANT_SLUG_MAX_LENGTH = 48

/** Minusculas, numeros y guiones; sin guion al principio ni al final. */
export const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

export type TenantSlugProblem = 'empty' | 'too_short' | 'too_long' | 'invalid_format' | 'reserved'

export type TenantSlugCheck =
  | { ok: true; slug: string }
  | { ok: false; reason: TenantSlugProblem; message: string }

const MENSAJES: Record<TenantSlugProblem, string> = {
  empty: 'Ingresá una dirección para tu tienda.',
  too_short: `La dirección necesita al menos ${TENANT_SLUG_MIN_LENGTH} caracteres.`,
  too_long: `La dirección no puede superar ${TENANT_SLUG_MAX_LENGTH} caracteres.`,
  invalid_format: 'Solo se permiten minúsculas, números y guiones.',
  reserved: 'Esa dirección está reservada por el sistema. Elegí otra.',
}

/**
 * Valida el formato y las reservas. No consulta la base: la disponibilidad se
 * verifica aparte, porque es lo unico que puede cambiar entre dos llamadas.
 */
export function validateTenantSlug(value: string): TenantSlugCheck {
  const slug = value.trim().toLowerCase()

  if (!slug) return { ok: false, reason: 'empty', message: MENSAJES.empty }
  if (slug.length < TENANT_SLUG_MIN_LENGTH) return { ok: false, reason: 'too_short', message: MENSAJES.too_short }
  if (slug.length > TENANT_SLUG_MAX_LENGTH) return { ok: false, reason: 'too_long', message: MENSAJES.too_long }
  if (!TENANT_SLUG_PATTERN.test(slug)) return { ok: false, reason: 'invalid_format', message: MENSAJES.invalid_format }
  if (RESERVED_TENANT_SLUGS.has(slug)) return { ok: false, reason: 'reserved', message: MENSAJES.reserved }

  return { ok: true, slug }
}

/**
 * Normaliza lo que escribio el usuario a un slug candidato. Se aplica tambien
 * en el servidor: hasta ahora la unica normalizacion vivia en el navegador, asi
 * que una llamada directa a la API podia crear una tienda con slug `Admin` o
 * `mi tienda`.
 */
export function normalizeTenantSlug(value: string): string {
  return slugifyTenantName(value).slice(0, TENANT_SLUG_MAX_LENGTH)
}

/**
 * Propone una variante libre a partir de una base tomada. Se numera al final
 * respetando el largo maximo, para no devolver una sugerencia que despues la
 * validacion rechace.
 */
export function suggestTenantSlug(base: string, estaTomado: (slug: string) => boolean): string | null {
  const raiz = normalizeTenantSlug(base) || 'tienda'

  for (let i = 2; i <= 30; i++) {
    const sufijo = `-${i}`
    const recorte = raiz.slice(0, TENANT_SLUG_MAX_LENGTH - sufijo.length).replace(/-+$/, '')
    const candidato = `${recorte}${sufijo}`
    const check = validateTenantSlug(candidato)
    if (check.ok && !estaTomado(candidato)) return candidato
  }

  return null
}

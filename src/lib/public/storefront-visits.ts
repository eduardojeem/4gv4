/**
 * Visitas a las tiendas públicas.
 *
 * Solo contadores por día y tipo de página: no se guarda nada de la persona.
 * Las reglas viven acá para que el navegador, la API y el panel usen el mismo
 * criterio.
 */

export const STOREFRONT_PAGES = ['inicio', 'productos', 'producto', 'ofertas', 'servicios', 'otra'] as const
export type StorefrontPage = (typeof STOREFRONT_PAGES)[number]

export const STOREFRONT_PAGE_LABELS: Record<StorefrontPage, string> = {
  inicio: 'Inicio',
  productos: 'Catálogo',
  producto: 'Ficha de producto',
  ofertas: 'Ofertas',
  servicios: 'Servicios',
  otra: 'Otras',
}

/** Páginas privadas o de trámite: no son una visita a la tienda. */
const NOT_A_VISIT = new Set(['carrito', 'perfil', 'cliente', 'favoritos', 'mis-reparaciones', 'track', 'checkout'])

/**
 * Qué tipo de página es, a partir de la ruta sin el prefijo de la tienda.
 * `null` cuando no cuenta como visita.
 */
export function classifyStorefrontPath(pathname: string, tenantSlug: string | null): StorefrontPage | null {
  let segments = pathname.split('?')[0].split('#')[0].split('/').filter(Boolean)
  if (tenantSlug && segments[0] === tenantSlug) segments = segments.slice(1)

  const [first, second] = segments
  if (!first || first === 'inicio') return 'inicio'
  if (NOT_A_VISIT.has(first)) return null
  if (first === 'productos') return second ? 'producto' : 'productos'
  if (first === 'ofertas') return 'ofertas'
  if (first === 'servicios') return 'servicios'
  return 'otra'
}

export function isStorefrontPage(value: unknown): value is StorefrontPage {
  return typeof value === 'string' && (STOREFRONT_PAGES as readonly string[]).includes(value)
}

/** Buscadores, vistas previas de enlaces y herramientas de medición no son visitas. */
const BOT_PATTERN = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|headless|lighthouse|pingdom|monitor|curl|wget|python|axios|node-fetch/i

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  return !userAgent || BOT_PATTERN.test(userAgent)
}

/**
 * La clave del navegador para saber si ya se contó a esta persona hoy en esta
 * tienda. El día es el local del navegador: alcanza para no contarla dos veces.
 */
export function visitorDayKey(organizationId: string, now = new Date()): string {
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return `storefront-visit:${organizationId}:${day}`
}

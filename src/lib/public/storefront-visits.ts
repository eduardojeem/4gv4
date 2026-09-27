/**
 * Tipos de página de las tiendas públicas para el panel de Superadmin → Landing.
 * Los contadores salen de `get_storefront_daily_visits` (site_analytics_events).
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

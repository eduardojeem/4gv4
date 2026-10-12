import type { BusinessVertical, OrganizationModule } from '@/lib/organization/business-profile'

/**
 * Qué módulo necesita cada sección del panel (y en qué rubros tiene sentido).
 *
 * Antes cada capa decidía por su cuenta: el menú del admin pedía módulo en 5
 * secciones, sus páginas revisaban solo el plan y sus API nada; en el dashboard
 * Clientes y Posventa no pedían CRM en el menú pero sí en la API, y abrían para
 * fallar al cargar. Esta tabla es la única fuente: la usan los menús, las
 * páginas y los tests, que fallan si aparece una página sin entrada.
 *
 * Se busca el prefijo más largo: `/dashboard/pos/caja` hereda de `/dashboard/pos`.
 * `module: null` dice explícitamente que la sección no depende de un módulo.
 */
export type RouteRequirement = {
  /** Con una lista alcanza con cualquiera de los módulos. */
  module: OrganizationModule | readonly OrganizationModule[] | null
  /** Solo en estos rubros. Sin lista, en todos. */
  verticals?: readonly BusinessVertical[]
  /** Página que no está enlazada desde ningún lado (resto de una versión vieja). */
  orphan?: boolean
}

export const ROUTE_MODULES = {
  // ── Admin ───────────────────────────────────────────────────────────────
  '/admin': { module: null },
  '/admin/analytics': { module: 'analytics' },
  '/admin/branches': { module: null },
  '/admin/cash-monitor': { module: 'pos' },
  '/admin/finances': { module: 'finances' },
  '/admin/guia': { module: null },
  '/admin/inventory': { module: 'inventory_admin' },
  '/admin/onboarding': { module: null },
  '/admin/reports': { module: 'reports' },
  '/admin/reviews': { module: null },
  '/admin/security': { module: 'security' },
  '/admin/settings': { module: null },
  '/admin/subscriptions': { module: null },
  '/admin/users': { module: null },
  '/admin/verify': { module: null },
  '/admin/visitas': { module: 'web_analytics' },
  '/admin/website': { module: null },

  // ── Dashboard ───────────────────────────────────────────────────────────
  '/dashboard': { module: null },
  '/dashboard/after-sales': { module: 'crm' },
  '/dashboard/agenda': { module: 'services' },
  '/dashboard/brands': { module: 'inventory' },
  '/dashboard/catalog': { module: 'inventory' },
  '/dashboard/categories': { module: 'inventory' },
  '/dashboard/credits': { module: 'credits' },
  '/dashboard/customers': { module: 'crm' },
  '/dashboard/inventory-count': { module: 'inventory' },
  '/dashboard/onboarding': { module: null },
  '/dashboard/orders': { module: 'orders' },
  '/dashboard/pos': { module: 'pos' },
  '/dashboard/posts': { module: null, orphan: true },
  '/dashboard/products': { module: ['inventory', 'services'] },
  '/dashboard/products/credit-defaults': { module: 'credits' },
  '/dashboard/products-modern': { module: 'inventory', orphan: true },
  '/dashboard/profile': { module: null },
  '/dashboard/promotions': { module: 'promotions' },
  '/dashboard/quotes': { module: 'pos' },
  '/dashboard/repairs': { module: 'repairs' },
  // Redirige a /admin/reports.
  '/dashboard/reports': { module: 'reports' },
  '/dashboard/settings': { module: null },
  '/dashboard/suppliers': { module: 'inventory' },
  '/dashboard/technician': { module: 'repairs' },
  '/dashboard/vencimientos': { module: 'inventory', verticals: ['food', 'cosmetics', 'general', 'other'] },
} as const satisfies Record<string, RouteRequirement>

export type KnownRoute = keyof typeof ROUTE_MODULES

/** El requisito de una ruta: el del prefijo más largo de la tabla. null si no está. */
export function requirementForPath(pathname: string): RouteRequirement | null {
  const path = pathname.split('?')[0].replace(/\/+$/, '') || '/'
  let best: string | null = null
  for (const route of Object.keys(ROUTE_MODULES)) {
    if ((path === route || path.startsWith(`${route}/`)) && (!best || route.length > best.length)) best = route
  }
  return best ? (ROUTE_MODULES as Record<string, RouteRequirement>)[best] : null
}

/** El módulo de una ruta conocida, para declararlo en los menús sin repetirlo. */
export function moduleForRoute(route: KnownRoute): RouteRequirement['module'] {
  return ROUTE_MODULES[route].module
}

/**
 * ¿La organización puede usar esta ruta? Con la lista de módulos efectivos
 * (plan + lo que eligió la tienda) y su rubro.
 */
export function isRouteAvailable(
  pathname: string,
  effectiveModules: readonly OrganizationModule[],
  businessVertical?: BusinessVertical | null,
): boolean {
  const requirement = requirementForPath(pathname)
  if (!requirement) return true
  const { module, verticals } = requirement
  if (module) {
    const anyOf: readonly OrganizationModule[] = typeof module === 'string' ? [module] : module
    if (!anyOf.some((candidate) => effectiveModules.includes(candidate))) return false
  }
  if (verticals?.length && businessVertical && !verticals.includes(businessVertical)) return false
  return true
}

/**
 * Quién tiene panel, y cómo se le ofrece.
 *
 * La dueña de una tienda entra al catálogo público como cualquiera: a mirar su
 * propia vidriera, a mandarle un producto a un cliente, a comprar en otra
 * tienda del marketplace. Sacarla de ahí al panel apenas inicia sesión le
 * interrumpe lo que estaba haciendo y la deja lejos de donde quería estar.
 *
 * La regla es al revés: se queda donde está, y el panel le queda ofrecido en
 * el menú. Este archivo es la única definición de «tiene panel», porque antes
 * cada barra tenía su propia lista de roles y se fueron desincronizando: el
 * encabezado de la tienda se olvidaba de `owner`, así que la dueña no veía
 * ninguna entrada al panel.
 */

/** Roles que trabajan adentro del negocio, no clientes. */
export const DASHBOARD_ROLES = [
  'super_admin',
  'admin',
  'owner',
  'vendedor',
  'tecnico',
  'inventory_manager',
] as const

type UsuarioConPanel = {
  role?: string | null
  organization?: { id?: string; slug?: string } | null
} | null | undefined

/**
 * Tener una organización alcanza: el rol global puede decir «cliente» aunque
 * la persona sea dueña de una tienda.
 */
export function canOpenDashboard(user: UsuarioConPanel): boolean {
  if (!user) return false
  if (user.organization) return true
  return typeof user.role === 'string' && (DASHBOARD_ROLES as readonly string[]).includes(user.role)
}

/**
 * El enlace de ingreso se lleva puesta la página actual, para volver a ella
 * después de entrar. `next` es el que entiende el ingreso de clientes de una
 * tienda; `redirect`, el del sistema.
 */
export function loginHrefWithReturn(base: string, pathname: string | null | undefined, param: 'next' | 'redirect'): string {
  const actual = (pathname ?? '').trim()
  // Sólo rutas internas, y nunca la propia pantalla de ingreso.
  if (!actual.startsWith('/') || actual.startsWith('//') || actual.includes('/cliente/login') || actual.startsWith('/login')) {
    return base
  }
  return `${base}?${param}=${encodeURIComponent(actual)}`
}

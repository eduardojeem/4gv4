import type { UserRole } from './roles-permissions'

/**
 * Fuente ÚNICA de verdad para el acceso por sección del dashboard.
 *
 * Solo `vendedor` y `tecnico` están restringidos. Cualquier otro rol con acceso
 * al dashboard (admin, super_admin, owner, o cliente-con-membresía que el
 * middleware ya validó) tiene acceso completo. Esto evita bloquear por error a
 * dueños cuyo `profiles.role` quedó como 'cliente'.
 *
 * La consume tanto el sidebar (para ocultar) como el guard del layout (para
 * cerrar el acceso por URL directa).
 */

const RESTRICTED_ROLES = ['vendedor', 'tecnico'] as const
type RestrictedRole = (typeof RESTRICTED_ROLES)[number]

// Prefijos de sección permitidos por rol restringido.
const ALLOWED_SECTIONS: Record<RestrictedRole, string[]> = {
  vendedor: [
    '/dashboard/pos',
    '/dashboard/customers',
    '/dashboard/orders',
    '/dashboard/credits',
    '/dashboard/repairs',
    '/dashboard/profile',
    '/dashboard/onboarding',
  ],
  tecnico: [
    '/dashboard/pos',
    '/dashboard/customers',
    '/dashboard/repairs',
    '/dashboard/technician',
    '/dashboard/profile',
    '/dashboard/onboarding',
  ],
}

function isRestricted(role: UserRole | undefined): role is RestrictedRole {
  return role === 'vendedor' || role === 'tecnico'
}

/** ¿Puede el rol acceder a la ruta del dashboard indicada? */
export function canRoleAccessSection(role: UserRole | undefined, path: string): boolean {
  // Roles no restringidos (admin, super_admin, owner, etc.) → acceso completo.
  if (!isRestricted(role)) return true

  // El home del dashboard siempre es accesible.
  if (path === '/dashboard') return true

  // Fuera del dashboard (p.ej. /admin) los roles restringidos no entran.
  if (!path.startsWith('/dashboard')) return false

  return ALLOWED_SECTIONS[role].some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  )
}

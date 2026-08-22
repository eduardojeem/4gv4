import type { UserRole } from './roles-permissions'
import type { OrganizationRole } from '@/lib/saas/permissions'

/**
 * Fuente unica de acceso por seccion del dashboard.
 *
 * El rol de la organizacion activa se traduce al modelo historico de la UI.
 * `cliente` falla cerrado: debe existir una membresia staff valida antes de
 * habilitar cualquier ruta del dashboard.
 */

type RestrictedRole = 'vendedor' | 'tecnico'

const BLOCKED_SECTIONS: string[] = [
  '/dashboard/pos/dashboard',
  '/dashboard/reports',
  '/dashboard/suppliers',
  '/dashboard/settings',
  '/dashboard/repairs/settings',
  '/dashboard/repairs/analytics',
  '/dashboard/repairs/technicians',
  '/admin'
]

const ALLOWED_SECTIONS: Record<RestrictedRole, string[]> = {
  vendedor: [
    '/dashboard/pos',
    '/dashboard/products',
    '/dashboard/categories',
    '/dashboard/customers',
    '/dashboard/orders',
    '/dashboard/credits',
    '/dashboard/repairs',
    '/dashboard/promotions',
    '/dashboard/profile',
    '/dashboard/onboarding',
  ],
  tecnico: [
    '/dashboard/pos',
    '/dashboard/products',
    '/dashboard/categories',
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

export function mapOrganizationRoleToDashboardRole(role: OrganizationRole): UserRole {
  switch (role) {
    case 'owner':
    case 'admin':
      return 'admin'
    case 'manager':
    case 'cashier':
    case 'seller':
      return 'vendedor'
    case 'technician':
      return 'tecnico'
    default:
      return 'cliente'
  }
}

export function canRoleAccessSection(role: UserRole | undefined, path: string): boolean {
  if (!role || role === 'cliente') return false
  if (!isRestricted(role)) return true
  if (path === '/dashboard') return true
  if (!path.startsWith('/dashboard')) return false

  // Check if explicitly blocked for restricted roles
  const isBlocked = BLOCKED_SECTIONS.some(
    (blocked) => path === blocked || path.startsWith(`${blocked}/`)
  )
  if (isBlocked) return false

  return ALLOWED_SECTIONS[role].some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  )
}

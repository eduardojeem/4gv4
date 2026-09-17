export type ManagedUserRole = 'super_admin' | 'owner' | 'admin' | 'vendedor' | 'tecnico' | 'cliente'

const ROLE_LABELS: Record<ManagedUserRole, string> = {
  super_admin: 'Super Admin',
  owner: 'Propietario',
  admin: 'Administrador',
  vendedor: 'Vendedor',
  tecnico: 'Técnico',
  cliente: 'Cliente',
}

export const MANAGED_USER_ROLES: readonly ManagedUserRole[] = ['super_admin', 'owner', 'admin', 'vendedor', 'tecnico', 'cliente']

/** Los nombres viejos y los del ingles que siguen llegando desde otras pantallas. */
const ROLE_ALIASES: Record<string, ManagedUserRole> = {
  technician: 'tecnico',
  customer: 'cliente',
  viewer: 'cliente',
  client_normal: 'cliente',
  mayorista: 'cliente',
  client_mayorista: 'cliente',
  seller: 'vendedor',
  cashier: 'vendedor',
  manager: 'vendedor',
  supervisor: 'vendedor',
  employee: 'vendedor',
}

export function normalizeManagedUserRole(role: unknown): ManagedUserRole {
  if (typeof role !== 'string') return 'cliente'
  const value = role.trim().toLowerCase()

  if ((MANAGED_USER_ROLES as readonly string[]).includes(value)) return value as ManagedUserRole
  return ROLE_ALIASES[value] ?? 'cliente'
}

/**
 * Si el rol existe o es un valor inventado. Hace falta para no guardar como
 * «cliente» lo que en realidad fue un error de escritura: quien queria ser
 * «vendedor» terminaba sin acceso al sistema.
 */
export function isKnownManagedUserRole(role: unknown): boolean {
  if (typeof role !== 'string') return false
  const value = role.trim().toLowerCase()
  return (MANAGED_USER_ROLES as readonly string[]).includes(value) || value in ROLE_ALIASES
}

export function getManagedRoleLabel(role: unknown) {
  return ROLE_LABELS[normalizeManagedUserRole(role)]
}

export function isProtectedOrganizationOwner(role: unknown) {
  return normalizeManagedUserRole(role) === 'owner'
}

export function canAssignRoleFromUserManagement(role: unknown) {
  return normalizeManagedUserRole(role) !== 'owner'
}

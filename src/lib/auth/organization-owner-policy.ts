export type ManagedUserRole = 'super_admin' | 'owner' | 'admin' | 'vendedor' | 'tecnico' | 'cliente'

const ROLE_LABELS: Record<ManagedUserRole, string> = {
  super_admin: 'Super Admin',
  owner: 'Propietario',
  admin: 'Administrador',
  vendedor: 'Vendedor',
  tecnico: 'Técnico',
  cliente: 'Cliente',
}

export function normalizeManagedUserRole(role: unknown): ManagedUserRole {
  if (typeof role !== 'string') return 'cliente'
  const value = role.trim().toLowerCase()

  if (value === 'super_admin' || value === 'owner' || value === 'admin' || value === 'vendedor' || value === 'tecnico' || value === 'cliente') {
    return value
  }
  if (value === 'technician') return 'tecnico'
  if (value === 'customer' || value === 'viewer' || value === 'client_normal' || value === 'mayorista' || value === 'client_mayorista') return 'cliente'
  if (value === 'seller' || value === 'cashier' || value === 'manager' || value === 'supervisor' || value === 'employee') return 'vendedor'
  return 'cliente'
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

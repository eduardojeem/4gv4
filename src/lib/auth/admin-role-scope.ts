import type { AppRole } from '@/lib/auth/role-utils'

export type OrganizationRole = 'admin' | 'seller' | 'technician' | 'customer'

export function canWriteGlobalUserIdentity(actorRole: string): boolean {
  return actorRole === 'super_admin'
}

export function mapAppRoleToOrganizationRole(role: AppRole): OrganizationRole {
  switch (role) {
    case 'admin':
      return 'admin'
    case 'vendedor':
      return 'seller'
    case 'tecnico':
      return 'technician'
    case 'cliente':
      return 'customer'
    case 'super_admin':
      throw new Error('super_admin is a global role')
  }
}

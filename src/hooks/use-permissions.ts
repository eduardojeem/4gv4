'use client'

import { useAuth } from '@/contexts/auth-context'
import { UserRole, Permission, PERMISSIONS, ROLE_PERMISSIONS } from '@/lib/auth/roles-permissions'
import { useMemo, useCallback } from 'react'

export interface PermissionCheck {
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
  hasResourceAccess: (resource: string, action: string) => boolean
  canAccessRoute: (route: string) => boolean
  canManageUser: (targetRole: UserRole) => boolean
  getUserPermissions: () => Permission[]
  getPermissionsByResource: (resource: string) => Permission[]
  isAuthorized: (requirements: PermissionRequirement) => boolean
}

export interface PermissionRequirement {
  permissions?: string[]
  roles?: UserRole[]
  requireAll?: boolean // Si true, requiere TODOS los permisos/roles, si false, requiere AL MENOS UNO
  resource?: string
  action?: string
}

// Mapeo de rutas a permisos requeridos
export const ROUTE_PERMISSIONS: Record<string, PermissionRequirement> = {
  '/admin': {
    roles: ['admin']
  },
  '/admin/users': {
    permissions: ['users.read'],
    requireAll: true
  },
  '/admin/products': {
    permissions: ['products.manage'],
    roles: ['admin']
  },
  '/admin/inventory': {
    permissions: ['inventory.read'],
    requireAll: true
  },
  '/admin/reports': {
    permissions: ['reports.read'],
    roles: ['admin']
  },
  '/admin/settings': {
    permissions: ['settings.read'],
    requireAll: true
  },
  '/dashboard/pos': {
    permissions: ['products.read'],
    roles: ['admin', 'vendedor'],
    requireAll: false
  },
  '/dashboard/categories': {
    permissions: ['products.read'],
    roles: ['admin', 'vendedor'],
    requireAll: false
  }
}

export function usePermissions(): PermissionCheck {
  const { user, hasPermission: authHasPermission, canManageUser: authCanManageUser } = useAuth()

  // Obtener permisos del usuario actual
  const userPermissions = useMemo(() => {
    if (!user?.role) return []
    return ROLE_PERMISSIONS[user.role]?.permissions || []
  }, [user?.role])

  // Verificar un permiso específico
  const hasPermission = useCallback((permission: string): boolean => {
    return authHasPermission(permission)
  }, [authHasPermission])

  // Verificar si tiene al menos uno de los permisos
  const hasAnyPermission = useCallback((permissions: string[]): boolean => {
    return permissions.some(permission => hasPermission(permission))
  }, [hasPermission])

  // Verificar si tiene todos los permisos
  const hasAllPermissions = useCallback((permissions: string[]): boolean => {
    return permissions.every(permission => hasPermission(permission))
  }, [hasPermission])

  // Verificar acceso a un recurso con una acción específica
  const hasResourceAccess = useCallback((resource: string, action: string): boolean => {
    if (!user?.role) return false

    const rolePermissions = ROLE_PERMISSIONS[user.role]
    return rolePermissions.permissions.some(p =>
      p.resource === resource && (p.action === action || p.action === 'manage')
    )
  }, [user?.role])

  // Verificar si puede acceder a una ruta específica
  const canAccessRoute = useCallback((route: string): boolean => {
    const requirement = ROUTE_PERMISSIONS[route]
    if (!requirement) return true // Si no hay requisitos, permitir acceso

    return isAuthorized(requirement)
  }, [])

  // Verificar si puede gestionar un usuario
  const canManageUser = useCallback((targetRole: UserRole): boolean => {
    return authCanManageUser(targetRole)
  }, [authCanManageUser])

  // Obtener todos los permisos del usuario
  const getUserPermissions = useCallback((): Permission[] => {
    return userPermissions
  }, [userPermissions])

  // Obtener permisos por recurso
  const getPermissionsByResource = useCallback((resource: string): Permission[] => {
    return userPermissions.filter(p => p.resource === resource)
  }, [userPermissions])

  // Verificar autorización compleja
  const isAuthorized = useCallback((requirements: PermissionRequirement): boolean => {
    if (!user?.role) return false

    const { permissions = [], roles = [], requireAll = false, resource, action } = requirements

    // Verificar roles si se especifican
    if (roles.length > 0) {
      const hasRole = roles.includes(user.role)
      if (requireAll && !hasRole) return false
      if (!requireAll && hasRole) return true
    }

    // Verificar permisos si se especifican
    if (permissions.length > 0) {
      const permissionCheck = requireAll
        ? hasAllPermissions(permissions)
        : hasAnyPermission(permissions)

      if (requireAll && !permissionCheck) return false
      if (!requireAll && permissionCheck) return true
    }

    // Verificar acceso a recurso específico
    if (resource && action) {
      return hasResourceAccess(resource, action)
    }

    // Si no hay requisitos específicos o se cumplieron parcialmente
    return roles.length === 0 && permissions.length === 0
  }, [user?.role, hasAllPermissions, hasAnyPermission, hasResourceAccess])

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasResourceAccess,
    canAccessRoute,
    canManageUser,
    getUserPermissions,
    getPermissionsByResource,
    isAuthorized
  }
}

// Hook para verificar permisos de forma reactiva
export function usePermissionGuard(requirements: PermissionRequirement) {
  const { isAuthorized } = usePermissions()

  return useMemo(() => ({
    isAuthorized: isAuthorized(requirements),
    requirements
  }), [isAuthorized, requirements])
}

// Hook para obtener permisos de una lista específica
export function usePermissionList(permissionIds: string[]) {
  const { hasPermission } = usePermissions()

  return useMemo(() => {
    return permissionIds.reduce((acc, permissionId) => {
      acc[permissionId] = hasPermission(permissionId)
      return acc
    }, {} as Record<string, boolean>)
  }, [permissionIds, hasPermission])
}

import { mapLegacyRoleToOrganizationRole, roleHasPermission, type Permission } from '@/lib/saas/permissions'
import { IMPLEMENTED_NOTIFICATION_TYPES, NOTIFICATION_METADATA, type NotificationType } from './types'

const IMPLEMENTED = new Set<NotificationType>(IMPLEMENTED_NOTIFICATION_TYPES)

/**
 * Si un aviso tiene sentido en las preferencias de este usuario: se envía de
 * verdad, su rol tiene el permiso y el módulo está activo para el comercio
 * (módulos efectivos: dependen del rubro y de lo que el comercio activó).
 * `modules` null = no se pudieron leer: no se filtra por módulo.
 */
export function isNotificationTypeVisible(
  type: NotificationType,
  context: { role?: string | null; modules?: readonly string[] | null },
): boolean {
  if (!IMPLEMENTED.has(type)) return false
  const metadata = NOTIFICATION_METADATA[type]
  if (metadata.requiredPermission && context.role) {
    const role = mapLegacyRoleToOrganizationRole(context.role)
    if (!roleHasPermission(role, metadata.requiredPermission as Permission)) return false
  }
  if (metadata.requiredModule && metadata.requiredModule !== 'security' && context.modules) {
    if (!context.modules.includes(metadata.requiredModule)) return false
  }
  return true
}

import {
  NOTIFICATION_METADATA,
  type NotificationCategory,
  type NotificationType,
} from './types'

export interface ResolvedPreference {
  pushEnabled: boolean
  inAppEnabled: boolean
}

/**
 * Resuelve las preferencias efectivas de un usuario para un tipo de notificación,
 * combinando la configuración explícita guardada (si existe) con los defaults seguros
 * basados en el rol del usuario dentro de la organización.
 */
export function resolveNotificationDefaultPreference(
  type: NotificationType,
  userRole?: string | null,
): ResolvedPreference {
  const meta = NOTIFICATION_METADATA[type]
  if (!meta) {
    return { pushEnabled: false, inAppEnabled: true }
  }

  const role = (userRole ?? 'seller').toLowerCase()
  const isPrivileged = role === 'owner' || role === 'admin' || role === 'manager'

  // 1. Seguridad y Sistema: siempre activos para todos los usuarios
  if (meta.category === 'security' || meta.category === 'system') {
    return {
      pushEnabled: meta.defaultPush,
      inAppEnabled: true,
    }
  }

  // 2. Tareas personales asignadas (ej. técnico asignado o cambio de sus propios permisos)
  if (meta.personal) {
    return {
      pushEnabled: meta.defaultPush,
      inAppEnabled: true,
    }
  }

  // 3. Ventas: Por defecto ON para propietarios, administradores y encargados; OFF para cajeros/vendedores
  if (meta.category === 'sales') {
    return {
      pushEnabled: isPrivileged,
      inAppEnabled: true,
    }
  }

  // 4. Inventario: OFF por defecto en push (para evitar spam masivo durante movimientos frecuentes)
  if (meta.category === 'inventory') {
    return {
      pushEnabled: false,
      inAppEnabled: true,
    }
  }

  // 5. Caja: Solo roles con gestión de tesorería
  if (meta.category === 'cash') {
    const hasCashRole = isPrivileged || role === 'cashier'
    return {
      pushEnabled: hasCashRole && meta.defaultPush,
      inAppEnabled: hasCashRole,
    }
  }

  // 6. Pedidos y Agenda/Servicios: ON si el usuario es privilegiado o vendedor/técnico
  if (meta.category === 'orders' || meta.category === 'services') {
    return {
      pushEnabled: meta.defaultPush,
      inAppEnabled: meta.defaultInApp,
    }
  }

  // 7. Proveedores: OFF por defecto en push
  if (meta.category === 'suppliers') {
    return {
      pushEnabled: false,
      inAppEnabled: isPrivileged,
    }
  }

  // 8. Administración / Empleados: solo propietarios y administradores
  if (meta.category === 'employees') {
    const isOwnerOrAdmin = role === 'owner' || role === 'admin'
    return {
      pushEnabled: isOwnerOrAdmin && meta.defaultPush,
      inAppEnabled: isOwnerOrAdmin,
    }
  }

  // Fallback seguro usando la metadata del tipo
  return {
    pushEnabled: meta.defaultPush,
    inAppEnabled: meta.defaultInApp,
  }
}

/**
 * Resuelve el estado predeterminado de una categoría completa de notificaciones.
 */
export function resolveCategoryDefault(
  category: NotificationCategory,
  userRole?: string | null,
): boolean {
  const role = (userRole ?? 'seller').toLowerCase()
  const isPrivileged = role === 'owner' || role === 'admin' || role === 'manager'

  switch (category) {
    case 'security':
    case 'system':
    case 'repairs':
    case 'orders':
    case 'services':
      return true
    case 'sales':
      return isPrivileged
    case 'cash':
      return isPrivileged || role === 'cashier'
    case 'inventory':
    case 'suppliers':
    case 'credits':
      return false
    case 'employees':
      return role === 'owner' || role === 'admin'
    default:
      return true
  }
}

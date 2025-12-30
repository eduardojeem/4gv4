import { toast } from 'sonner'
import { NotificationError, ErrorType } from './error-handling'

// Tipos de contexto para las notificaciones
export enum NotificationContext {
  PRODUCT_MANAGEMENT = 'product_management',
  USER_MANAGEMENT = 'user_management',
  INVENTORY = 'inventory',
  SALES = 'sales',
  AUTHENTICATION = 'authentication',
  SETTINGS = 'settings',
  IMPORT_EXPORT = 'import_export',
  GENERAL = 'general'
}

// Tipos de acciones específicas
export enum ActionType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  DUPLICATE = 'duplicate',
  IMPORT = 'import',
  EXPORT = 'export',
  TOGGLE = 'toggle',
  REFRESH = 'refresh',
  SAVE = 'save',
  LOAD = 'load',
  SEARCH = 'search',
  FILTER = 'filter',
  SORT = 'sort'
}

// Configuración de mensajes contextuales
interface ContextualMessage {
  loading: string
  success: string | ((data?: Record<string, unknown>) => string)
  error: string | ((error: NotificationError) => string)
  description?: string
  duration?: number
  icon?: string
}

// Configuración de mensajes por contexto y acción
const CONTEXTUAL_MESSAGES: Record<NotificationContext, Partial<Record<ActionType, ContextualMessage>>> = {
  [NotificationContext.PRODUCT_MANAGEMENT]: {
    [ActionType.CREATE]: {
      loading: 'Creando producto...',
      success: (data) => `Producto "${data?.name || 'nuevo'}" creado exitosamente`,
      error: (error) => `Error al crear producto: ${error.message}`,
      description: 'El producto se ha agregado al catálogo',
      duration: 4000,
      icon: '📦'
    },
    [ActionType.UPDATE]: {
      loading: 'Actualizando producto...',
      success: (data) => `Producto "${data?.name || ''}" actualizado`,
      error: (error) => `Error al actualizar producto: ${error.message}`,
      description: 'Los cambios se han guardado correctamente',
      duration: 3000,
      icon: '✏️'
    },
    [ActionType.DELETE]: {
      loading: 'Eliminando producto...',
      success: 'Producto eliminado exitosamente',
      error: (error) => `Error al eliminar producto: ${error.message}`,
      description: 'El producto se ha removido del catálogo',
      duration: 3000,
      icon: '🗑️'
    },
    [ActionType.DUPLICATE]: {
      loading: 'Duplicando producto...',
      success: (data) => `Producto duplicado como "${data?.name || 'copia'}"`,
      error: (error) => `Error al duplicar producto: ${error.message}`,
      description: 'Se ha creado una copia del producto',
      duration: 3000,
      icon: '📋'
    },
    [ActionType.TOGGLE]: {
      loading: 'Actualizando estado...',
      success: (data) => `Producto ${data?.featured ? 'destacado' : 'no destacado'}`,
      error: (error) => `Error al cambiar estado: ${error.message}`,
      duration: 2000,
      icon: '⭐'
    },
    [ActionType.REFRESH]: {
      loading: 'Actualizando productos...',
      success: (data) => `${data?.count || 0} productos actualizados`,
      error: (error) => `Error al actualizar: ${error.message}`,
      description: 'La lista de productos se ha sincronizado',
      duration: 2000,
      icon: '🔄'
    }
  },
  [NotificationContext.IMPORT_EXPORT]: {
    [ActionType.IMPORT]: {
      loading: 'Importando datos...',
      success: (data) => `${data?.imported || 0} elementos importados exitosamente`,
      error: (error) => `Error en importación: ${error.message}`,
      description: 'Los datos se han procesado e integrado',
      duration: 5000,
      icon: '📥'
    },
    [ActionType.EXPORT]: {
      loading: 'Preparando exportación...',
      success: (data) => `${data?.exported || 0} elementos exportados`,
      error: (error) => `Error en exportación: ${error.message}`,
      description: 'Los datos están listos para descargar',
      duration: 4000,
      icon: '📤'
    }
  },
  [NotificationContext.AUTHENTICATION]: {
    [ActionType.SAVE]: {
      loading: 'Iniciando sesión...',
      success: 'Sesión iniciada exitosamente',
      error: (error) => `Error de autenticación: ${error.message}`,
      description: 'Bienvenido de vuelta',
      duration: 3000,
      icon: '🔐'
    }
  },
  [NotificationContext.SETTINGS]: {
    [ActionType.SAVE]: {
      loading: 'Guardando configuración...',
      success: 'Configuración guardada exitosamente',
      error: (error) => `Error al guardar: ${error.message}`,
      description: 'Los cambios se han aplicado',
      duration: 3000,
      icon: '⚙️'
    }
  },
  [NotificationContext.GENERAL]: {
    [ActionType.SAVE]: {
      loading: 'Guardando...',
      success: 'Guardado exitosamente',
      error: (error) => `Error al guardar: ${error.message}`,
      duration: 2000,
      icon: '💾'
    },
    [ActionType.LOAD]: {
      loading: 'Cargando...',
      success: 'Cargado exitosamente',
      error: (error) => `Error al cargar: ${error.message}`,
      duration: 2000,
      icon: '📂'
    }
  }
}

// Generador de notificaciones contextuales
export class ContextualNotificationGenerator {
  static generate(
    context: NotificationContext,
    action: ActionType,
    type: 'loading' | 'success' | 'error',
    data?: any,
    error?: NotificationError
  ): { message: string; description?: string; duration?: number; icon?: string } {
    const contextMessages = CONTEXTUAL_MESSAGES[context]
    const actionMessages = contextMessages?.[action]

    if (!actionMessages) {
      return this.generateFallback(action, type, data, error)
    }

    let message: string
    switch (type) {
      case 'loading':
        message = actionMessages.loading
        break
      case 'success':
        message = typeof actionMessages.success === 'function' 
          ? actionMessages.success(data) 
          : actionMessages.success
        break
      case 'error':
        message = typeof actionMessages.error === 'function' 
          ? actionMessages.error(error!) 
          : actionMessages.error
        break
    }

    return {
      message,
      description: actionMessages.description,
      duration: actionMessages.duration,
      icon: actionMessages.icon
    }
  }

  private static generateFallback(
    action: ActionType,
    type: 'loading' | 'success' | 'error',
    data?: any,
    error?: NotificationError
  ): { message: string; description?: string; duration?: number } {
    const actionNames: Record<ActionType, string> = {
      [ActionType.CREATE]: 'crear',
      [ActionType.UPDATE]: 'actualizar',
      [ActionType.DELETE]: 'eliminar',
      [ActionType.DUPLICATE]: 'duplicar',
      [ActionType.IMPORT]: 'importar',
      [ActionType.EXPORT]: 'exportar',
      [ActionType.TOGGLE]: 'cambiar',
      [ActionType.REFRESH]: 'actualizar',
      [ActionType.SAVE]: 'guardar',
      [ActionType.LOAD]: 'cargar',
      [ActionType.SEARCH]: 'buscar',
      [ActionType.FILTER]: 'filtrar',
      [ActionType.SORT]: 'ordenar'
    }

    const actionName = actionNames[action] || 'procesar'

    switch (type) {
      case 'loading':
        return { message: `${actionName.charAt(0).toUpperCase() + actionName.slice(1)}ando...`, duration: 2000 }
      case 'success':
        return { message: `${actionName.charAt(0).toUpperCase() + actionName.slice(1)}ado exitosamente`, duration: 3000 }
      case 'error':
        return { 
          message: `Error al ${actionName}: ${error?.message || 'Error desconocido'}`, 
          duration: 4000 
        }
    }
  }
}

// Hook para notificaciones contextuales
export function useContextualNotifications() {
  const notify = (
    context: NotificationContext,
    action: ActionType,
    type: 'loading' | 'success' | 'error' | 'info' | 'warning',
    options?: {
      data?: any
      error?: NotificationError
      customMessage?: string
      customDescription?: string
      customDuration?: number
      position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center'
    }
  ) => {
    const { data, error, customMessage, customDescription, customDuration, position } = options || {}

    let notificationConfig: { message: string; description?: string; duration?: number; icon?: string }

    if (customMessage) {
      notificationConfig = {
        message: customMessage,
        description: customDescription,
        duration: customDuration || 3000
      }
    } else {
      notificationConfig = ContextualNotificationGenerator.generate(context, action, type as any, data, error)
    }

    const toastOptions = {
      description: notificationConfig.description,
      duration: notificationConfig.duration || 3000,
      position,
      className: `toast-optimized toast-${type}`,
    }

    switch (type) {
      case 'loading':
        return toast.loading(notificationConfig.message, {
          ...toastOptions,
          duration: Infinity
        })
      case 'success':
        return toast.success(notificationConfig.message, toastOptions)
      case 'error':
        return toast.error(notificationConfig.message, {
          ...toastOptions,
          duration: notificationConfig.duration || 5000
        })
      case 'warning':
        return toast.warning(notificationConfig.message, toastOptions)
      case 'info':
        return toast.info(notificationConfig.message, toastOptions)
      default:
        return toast(notificationConfig.message, toastOptions)
    }
  }

  const notifyProductAction = (
    action: ActionType,
    type: 'loading' | 'success' | 'error',
    options?: { data?: any; error?: NotificationError }
  ) => {
    return notify(NotificationContext.PRODUCT_MANAGEMENT, action, type, options)
  }

  const notifyImportExport = (
    action: ActionType.IMPORT | ActionType.EXPORT,
    type: 'loading' | 'success' | 'error',
    options?: { data?: any; error?: NotificationError }
  ) => {
    return notify(NotificationContext.IMPORT_EXPORT, action, type, options)
  }

  const notifyAuth = (
    type: 'loading' | 'success' | 'error',
    options?: { data?: any; error?: NotificationError }
  ) => {
    return notify(NotificationContext.AUTHENTICATION, ActionType.SAVE, type, options)
  }

  const notifySettings = (
    type: 'loading' | 'success' | 'error',
    options?: { data?: any; error?: NotificationError }
  ) => {
    return notify(NotificationContext.SETTINGS, ActionType.SAVE, type, options)
  }

  return {
    notify,
    notifyProductAction,
    notifyImportExport,
    notifyAuth,
    notifySettings,
    NotificationContext,
    ActionType
  }
}

// Utilidades para crear notificaciones rápidas (sin hooks)
export const quickNotifications = {
  productCreated: (productName?: string) => {
    toast.success(`Producto "${productName || 'nuevo'}" creado exitosamente`, {
      description: 'El producto se ha agregado al catálogo',
      duration: 3000
    })
  },

  productUpdated: (productName?: string) => {
    toast.success(`Producto "${productName || ''}" actualizado exitosamente`, {
      description: 'Los cambios se han guardado correctamente',
      duration: 3000
    })
  },

  productDeleted: () => {
    toast.success('Producto eliminado exitosamente', {
      description: 'El producto se ha removido del catálogo',
      duration: 3000
    })
  },

  importCompleted: (count: number) => {
    toast.success(`Importación completada: ${count} elementos`, {
      description: 'Los datos se han importado correctamente',
      duration: 4000
    })
  },

  exportCompleted: (count: number) => {
    toast.success(`Exportación completada: ${count} elementos`, {
      description: 'Los datos se han exportado correctamente',
      duration: 4000
    })
  }
}

// Configuración de notificaciones por defecto
export const DEFAULT_NOTIFICATION_CONFIG = {
  duration: {
    loading: Infinity,
    success: 3000,
    error: 5000,
    warning: 4000,
    info: 3000
  },
  position: 'top-right' as const,
  maxVisible: 5,
  closeButton: true,
  richColors: true
}
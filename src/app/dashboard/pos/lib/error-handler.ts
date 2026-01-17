/**
 * Sistema centralizado de manejo de errores para el POS
 * Proporciona mensajes user-friendly y logging estructurado
 */

import { toast } from 'sonner'

export type ErrorContext = 
  | 'sale'
  | 'payment'
  | 'inventory'
  | 'customer'
  | 'register'
  | 'sync'
  | 'validation'
  | 'network'
  | 'auth'
  | 'unknown'

export interface POSError {
  context: ErrorContext
  message: string
  originalError?: unknown
  timestamp: Date
  userId?: string
  metadata?: Record<string, any>
}

export class POSErrorHandler {
  private static errors: POSError[] = []
  private static maxErrors = 100

  /**
   * Maneja un error y muestra un mensaje apropiado al usuario
   */
  static handle(error: unknown, context: ErrorContext, metadata?: Record<string, any>): void {
    const posError = this.createPOSError(error, context, metadata)
    this.logError(posError)
    this.showUserMessage(posError)
  }

  /**
   * Crea un objeto POSError estructurado
   */
  private static createPOSError(error: unknown, context: ErrorContext, metadata?: Record<string, any>): POSError {
    return {
      context,
      message: this.extractMessage(error),
      originalError: error,
      timestamp: new Date(),
      metadata
    }
  }

  /**
   * Extrae un mensaje legible del error
   */
  private static extractMessage(error: unknown): string {
    if (!error) return 'Error desconocido'
    if (typeof error === 'string') return error
    if (error && typeof error === 'object') {
      if ('message' in error) return String(error.message)
      if ('error' in error) return String(error.error)
      if ('error_description' in error) return String(error.error_description)
      if ('details' in error) return String(error.details)
      if ('hint' in error) return String(error.hint)
    }
    try {
      return JSON.stringify(error)
    } catch {
      return String(error)
    }
  }

  /**
   * Registra el error en el historial
   */
  private static logError(error: POSError): void {
    this.errors.push(error)
    if (this.errors.length > this.maxErrors) {
      this.errors.shift()
    }

    // Log estructurado en consola
    console.error(`[POS Error - ${error.context}]`, {
      message: error.message,
      timestamp: error.timestamp.toISOString(),
      metadata: error.metadata,
      originalError: error.originalError
    })
  }

  /**
   * Muestra un mensaje apropiado al usuario según el contexto
   */
  private static showUserMessage(error: POSError): void {
    const message = this.getUserFriendlyMessage(error)
    
    // Determinar el tipo de toast según la severidad
    if (this.isWarning(error)) {
      toast.warning(message)
    } else if (this.isCritical(error)) {
      toast.error(message, { duration: 10000 })
    } else {
      toast.error(message)
    }
  }

  /**
   * Convierte el error en un mensaje amigable para el usuario
   */
  private static getUserFriendlyMessage(error: POSError): string {
    const msg = error.message.toLowerCase()

    // Errores de red
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection')) {
      return 'Error de conexión. Verifica tu conexión a internet e intenta nuevamente.'
    }

    // Errores de autenticación
    if (msg.includes('jwt') || msg.includes('auth') || msg.includes('unauthorized') || msg.includes('permission')) {
      return 'Tu sesión ha expirado o no tienes permisos. Por favor, inicia sesión nuevamente.'
    }

    // Errores de base de datos
    if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
      return 'Este registro ya existe en el sistema.'
    }

    if (msg.includes('foreign key') || msg.includes('violates')) {
      return 'No se puede completar la operación debido a dependencias en el sistema.'
    }

    if (msg.includes('not null') || msg.includes('required')) {
      return 'Faltan datos requeridos. Por favor, completa todos los campos obligatorios.'
    }

    if (msg.includes('timeout')) {
      return 'La operación tardó demasiado. Por favor, intenta nuevamente.'
    }

    // Errores de tabla no encontrada
    if (msg.includes("could not find the table") || msg.includes('relation') && msg.includes('does not exist')) {
      return 'Funcionalidad no disponible. Contacta al administrador del sistema.'
    }

    // Errores específicos del contexto
    switch (error.context) {
      case 'sale':
        return `Error al procesar la venta: ${error.message}`
      case 'payment':
        return `Error en el pago: ${error.message}`
      case 'inventory':
        return `Error en el inventario: ${error.message}`
      case 'customer':
        return `Error con el cliente: ${error.message}`
      case 'register':
        return `Error en la caja: ${error.message}`
      case 'sync':
        return 'Error al sincronizar datos. Los cambios se guardarán localmente.'
      case 'validation':
        return `Validación fallida: ${error.message}`
      default:
        return `Error: ${error.message}`
    }
  }

  /**
   * Determina si el error es una advertencia (no crítico)
   */
  private static isWarning(error: POSError): boolean {
    const msg = error.message.toLowerCase()
    return msg.includes('warning') || 
           msg.includes('tabla') && msg.includes('no encontrada') ||
           error.context === 'sync'
  }

  /**
   * Determina si el error es crítico
   */
  private static isCritical(error: POSError): boolean {
    return error.context === 'payment' || 
           error.context === 'sale' ||
           error.context === 'auth'
  }

  /**
   * Obtiene el historial de errores
   */
  static getErrorHistory(): POSError[] {
    return [...this.errors]
  }

  /**
   * Limpia el historial de errores
   */
  static clearErrorHistory(): void {
    this.errors = []
  }

  /**
   * Obtiene estadísticas de errores
   */
  static getErrorStats(): Record<ErrorContext, number> {
    const stats: Record<string, number> = {}
    
    for (const error of this.errors) {
      stats[error.context] = (stats[error.context] || 0) + 1
    }
    
    return stats as Record<ErrorContext, number>
  }

  /**
   * Exporta errores para debugging
   */
  static exportErrors(): string {
    return JSON.stringify(this.errors, null, 2)
  }
}

/**
 * Hook para usar el error handler en componentes
 */
export function usePOSErrorHandler() {
  const handleError = (error: unknown, context: ErrorContext, metadata?: Record<string, any>) => {
    POSErrorHandler.handle(error, context, metadata)
  }

  const getErrorHistory = () => POSErrorHandler.getErrorHistory()
  const clearErrors = () => POSErrorHandler.clearErrorHistory()
  const getStats = () => POSErrorHandler.getErrorStats()
  const exportErrors = () => POSErrorHandler.exportErrors()

  return {
    handleError,
    getErrorHistory,
    clearErrors,
    getStats,
    exportErrors
  }
}

/**
 * Wrapper para funciones async con manejo de errores automático
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: ErrorContext,
  metadata?: Record<string, any>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      POSErrorHandler.handle(error, context, metadata)
      throw error
    }
  }) as T
}

/**
 * Decorator para métodos de clase con manejo de errores
 */
export function HandleErrors(context: ErrorContext) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args)
      } catch (error) {
        POSErrorHandler.handle(error, context, {
          method: propertyKey,
          args: args.map(arg => typeof arg === 'object' ? '[Object]' : String(arg))
        })
        throw error
      }
    }

    return descriptor
  }
}

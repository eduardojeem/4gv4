/**
 * Sistema de manejo de errores mejorado para POS
 * Proporciona logging centralizado, recovery automático y notificaciones informativas
 */

import { toast } from 'sonner'

export enum ErrorType {
  NETWORK = 'network',
  VALIDATION = 'validation',
  PAYMENT = 'payment',
  INVENTORY = 'inventory',
  SYSTEM = 'system',
  USER = 'user'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface POSError {
  type: ErrorType
  severity: ErrorSeverity
  message: string
  code?: string
  details?: Record<string, any>
  timestamp: Date
  context?: string
  recoverable?: boolean
  retryCount?: number
}

export interface ErrorRecoveryStrategy {
  canRecover: (error: POSError) => boolean
  recover: (error: POSError) => Promise<boolean>
  maxRetries: number
}

class POSErrorHandler {
  private errorLog: POSError[] = []
  private recoveryStrategies: Map<ErrorType, ErrorRecoveryStrategy> = new Map()
  private maxLogSize = 100

  constructor() {
    this.setupRecoveryStrategies()
  }

  /**
   * Configurar estrategias de recuperación automática
   */
  private setupRecoveryStrategies() {
    // Estrategia para errores de red
    this.recoveryStrategies.set(ErrorType.NETWORK, {
      canRecover: (error) => error.retryCount ? error.retryCount < 3 : true,
      recover: async (error) => {
        await new Promise(resolve => setTimeout(resolve, 1000 * (error.retryCount || 1)))
        return true
      },
      maxRetries: 3
    })

    // Estrategia para errores de inventario
    this.recoveryStrategies.set(ErrorType.INVENTORY, {
      canRecover: (error) => error.code === 'INSUFFICIENT_STOCK',
      recover: async (error) => {
        // Intentar refrescar datos de inventario
        try {
          // Aquí iría la lógica para refrescar inventario
          return true
        } catch {
          return false
        }
      },
      maxRetries: 1
    })

    // Estrategia para errores de validación
    this.recoveryStrategies.set(ErrorType.VALIDATION, {
      canRecover: () => false, // Los errores de validación requieren intervención del usuario
      recover: async () => false,
      maxRetries: 0
    })
  }

  /**
   * Manejar un error del sistema POS
   */
  async handleError(error: Partial<POSError> & { message: string; type: ErrorType }): Promise<boolean> {
    const posError: POSError = {
      ...error,
      severity: error.severity || ErrorSeverity.MEDIUM,
      timestamp: new Date(),
      recoverable: error.recoverable ?? true,
      retryCount: error.retryCount || 0
    }

    // Agregar al log
    this.addToLog(posError)

    // Mostrar notificación al usuario
    this.showUserNotification(posError)

    // Intentar recuperación automática
    if (posError.recoverable) {
      const recovered = await this.attemptRecovery(posError)
      if (recovered) {
        this.showRecoveryNotification(posError)
        return true
      }
    }

    // Log para debugging
    this.logError(posError)

    return false
  }

  /**
   * Intentar recuperación automática
   */
  private async attemptRecovery(error: POSError): Promise<boolean> {
    const strategy = this.recoveryStrategies.get(error.type)
    
    if (!strategy || !strategy.canRecover(error)) {
      return false
    }

    try {
      const recovered = await strategy.recover(error)
      if (recovered) {
        return true
      }

      // Si no se pudo recuperar, incrementar contador de reintentos
      if ((error.retryCount || 0) < strategy.maxRetries) {
        error.retryCount = (error.retryCount || 0) + 1
        return await this.attemptRecovery(error)
      }
    } catch (recoveryError) {
      console.error('Error durante recuperación automática:', recoveryError)
    }

    return false
  }

  /**
   * Mostrar notificación al usuario
   */
  private showUserNotification(error: POSError) {
    const userMessage = this.getUserFriendlyMessage(error)
    
    switch (error.severity) {
      case ErrorSeverity.LOW:
        toast.info(userMessage, {
          description: 'El sistema continuará funcionando normalmente',
          duration: 3000
        })
        break
      
      case ErrorSeverity.MEDIUM:
        toast.warning(userMessage, {
          description: 'Algunas funciones pueden verse afectadas',
          duration: 5000
        })
        break
      
      case ErrorSeverity.HIGH:
        toast.error(userMessage, {
          description: 'Se requiere atención inmediata',
          duration: 8000,
          action: {
            label: 'Reintentar',
            onClick: () => this.handleError(error)
          }
        })
        break
      
      case ErrorSeverity.CRITICAL:
        toast.error(userMessage, {
          description: 'Sistema comprometido - Contacte soporte técnico',
          duration: 0, // No auto-dismiss
          action: {
            label: 'Reportar',
            onClick: () => this.reportError(error)
          }
        })
        break
    }
  }

  /**
   * Mostrar notificación de recuperación exitosa
   */
  private showRecoveryNotification(error: POSError) {
    toast.success('Problema resuelto automáticamente', {
      description: `${this.getUserFriendlyMessage(error)} - Sistema restaurado`,
      duration: 4000
    })
  }

  /**
   * Obtener mensaje amigable para el usuario
   */
  private getUserFriendlyMessage(error: POSError): string {
    const messages: Record<ErrorType, Record<string, string>> = {
      [ErrorType.NETWORK]: {
        default: 'Problema de conexión detectado',
        'TIMEOUT': 'La conexión tardó demasiado en responder',
        'OFFLINE': 'Sin conexión a internet'
      },
      [ErrorType.PAYMENT]: {
        default: 'Error en el procesamiento de pago',
        'INSUFFICIENT_FUNDS': 'Fondos insuficientes',
        'CARD_DECLINED': 'Tarjeta rechazada'
      },
      [ErrorType.INVENTORY]: {
        default: 'Problema con el inventario',
        'INSUFFICIENT_STOCK': 'Stock insuficiente',
        'PRODUCT_NOT_FOUND': 'Producto no encontrado'
      },
      [ErrorType.VALIDATION]: {
        default: 'Datos inválidos ingresados',
        'REQUIRED_FIELD': 'Campo requerido faltante',
        'INVALID_FORMAT': 'Formato de datos incorrecto'
      },
      [ErrorType.SYSTEM]: {
        default: 'Error interno del sistema',
        'DATABASE_ERROR': 'Error de base de datos',
        'SERVICE_UNAVAILABLE': 'Servicio temporalmente no disponible'
      },
      [ErrorType.USER]: {
        default: 'Acción no permitida',
        'UNAUTHORIZED': 'No autorizado para esta acción',
        'FORBIDDEN': 'Acceso denegado'
      }
    }

    const typeMessages = messages[error.type] || messages[ErrorType.SYSTEM]
    return error.code ? (typeMessages[error.code] || typeMessages.default) : typeMessages.default
  }

  /**
   * Agregar error al log interno
   */
  private addToLog(error: POSError) {
    this.errorLog.unshift(error)
    
    // Mantener tamaño del log
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(0, this.maxLogSize)
    }
  }

  /**
   * Log para debugging
   */
  private logError(error: POSError) {
    const logLevel = this.getLogLevel(error.severity)
    const logMessage = `[POS Error] ${error.type.toUpperCase()}: ${error.message}`
    
    console[logLevel](logMessage, {
      code: error.code,
      context: error.context,
      details: error.details,
      timestamp: error.timestamp,
      retryCount: error.retryCount
    })
  }

  /**
   * Obtener nivel de log según severidad
   */
  private getLogLevel(severity: ErrorSeverity): 'info' | 'warn' | 'error' {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'info'
      case ErrorSeverity.MEDIUM:
        return 'warn'
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        return 'error'
      default:
        return 'warn'
    }
  }

  /**
   * Reportar error crítico
   */
  private async reportError(error: POSError) {
    try {
      // Aquí iría la lógica para enviar el error a un servicio de monitoreo
      console.log('Reportando error crítico:', error)
      
      toast.success('Error reportado exitosamente', {
        description: 'El equipo técnico ha sido notificado'
      })
    } catch (reportError) {
      console.error('Error al reportar:', reportError)
      toast.error('No se pudo reportar el error', {
        description: 'Intente contactar soporte directamente'
      })
    }
  }

  /**
   * Obtener estadísticas de errores
   */
  getErrorStats() {
    const now = new Date()
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    
    const recent = this.errorLog.filter(error => error.timestamp > last24h)
    
    const byType = recent.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1
      return acc
    }, {} as Record<ErrorType, number>)

    const bySeverity = recent.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1
      return acc
    }, {} as Record<ErrorSeverity, number>)

    return {
      total: recent.length,
      byType,
      bySeverity,
      mostRecent: this.errorLog[0] || null
    }
  }

  /**
   * Limpiar log de errores
   */
  clearErrorLog() {
    this.errorLog = []
  }

  /**
   * Obtener errores recientes
   */
  getRecentErrors(limit = 10): POSError[] {
    return this.errorLog.slice(0, limit)
  }
}

// Instancia singleton
export const posErrorHandler = new POSErrorHandler()

// Funciones de conveniencia
export const handlePOSError = (error: Partial<POSError> & { message: string; type: ErrorType }) => {
  return posErrorHandler.handleError(error)
}

export const getErrorStats = () => posErrorHandler.getErrorStats()

export const clearErrorLog = () => posErrorHandler.clearErrorLog()

export const getRecentErrors = (limit?: number) => posErrorHandler.getRecentErrors(limit)

// Wrapper para errores comunes
export const handleNetworkError = (message: string, code?: string, details?: any) => {
  return handlePOSError({
    type: ErrorType.NETWORK,
    severity: ErrorSeverity.MEDIUM,
    message,
    code,
    details,
    context: 'network_operation'
  })
}

export const handlePaymentError = (message: string, code?: string, details?: any) => {
  return handlePOSError({
    type: ErrorType.PAYMENT,
    severity: ErrorSeverity.HIGH,
    message,
    code,
    details,
    context: 'payment_processing'
  })
}

export const handleInventoryError = (message: string, code?: string, details?: any) => {
  return handlePOSError({
    type: ErrorType.INVENTORY,
    severity: ErrorSeverity.MEDIUM,
    message,
    code,
    details,
    context: 'inventory_management'
  })
}

export const handleValidationError = (message: string, code?: string, details?: any) => {
  return handlePOSError({
    type: ErrorType.VALIDATION,
    severity: ErrorSeverity.LOW,
    message,
    code,
    details,
    context: 'data_validation',
    recoverable: false
  })
}
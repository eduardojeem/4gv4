import { toast } from 'sonner'

// Tipos de errores específicos
export enum ErrorType {
  NETWORK = 'network',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  SERVER = 'server',
  CLIENT = 'client',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

// Configuración de reintentos
export interface RetryConfig {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  retryableErrors: ErrorType[]
}

// Error personalizado con contexto
export class NotificationError extends Error {
  public readonly type: ErrorType
  public readonly code?: string
  public readonly context?: Record<string, unknown>
  public readonly timestamp: Date
  public readonly retryable: boolean

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    options?: {
      code?: string
      context?: Record<string, unknown>
      retryable?: boolean
      cause?: Error
    }
  ) {
    super(message)
    this.name = 'NotificationError'
    this.type = type
    this.code = options?.code
    this.context = options?.context
    this.timestamp = new Date()
    this.retryable = options?.retryable ?? this.isRetryableByDefault(type)
    
    if (options?.cause) {
      this.cause = options.cause
    }
  }

  private isRetryableByDefault(type: ErrorType): boolean {
    return [ErrorType.NETWORK, ErrorType.TIMEOUT, ErrorType.SERVER].includes(type)
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      retryable: this.retryable,
      stack: this.stack
    }
  }
}

// Configuración por defecto para reintentos
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: [ErrorType.NETWORK, ErrorType.TIMEOUT, ErrorType.SERVER]
}

// Clasificador de errores
export class ErrorClassifier {
  static classify(error: unknown): NotificationError {
    if (error instanceof NotificationError) {
      return error
    }

    if (error instanceof Error) {
      const type = this.determineErrorType(error)
      return new NotificationError(error.message, type, { cause: error })
    }

    if (typeof error === 'string') {
      return new NotificationError(error, ErrorType.CLIENT)
    }

    return new NotificationError(
      'Error desconocido',
      ErrorType.UNKNOWN,
      { context: { originalError: error } }
    )
  }

  private static determineErrorType(error: Error): ErrorType {
    const message = error.message.toLowerCase()
    const name = error.name.toLowerCase()

    // Errores de red
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection') ||
      name.includes('networkerror')
    ) {
      return ErrorType.NETWORK
    }

    // Errores de timeout
    if (
      message.includes('timeout') ||
      message.includes('aborted') ||
      name.includes('timeouterror')
    ) {
      return ErrorType.TIMEOUT
    }

    // Errores de validación
    if (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('required')
    ) {
      return ErrorType.VALIDATION
    }

    // Errores de autenticación
    if (
      message.includes('unauthorized') ||
      message.includes('authentication') ||
      message.includes('login')
    ) {
      return ErrorType.AUTHENTICATION
    }

    // Errores de autorización
    if (
      message.includes('forbidden') ||
      message.includes('permission') ||
      message.includes('access denied')
    ) {
      return ErrorType.AUTHORIZATION
    }

    // Errores del servidor
    if (
      message.includes('server') ||
      message.includes('internal') ||
      message.includes('500') ||
      message.includes('503')
    ) {
      return ErrorType.SERVER
    }

    return ErrorType.CLIENT
  }
}

// Manejador de reintentos con backoff exponencial
export class RetryHandler {
  private config: RetryConfig

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config }
  }

  async execute<T>(
    operation: () => Promise<T>,
    context?: string
  ): Promise<T> {
    let lastError: NotificationError
    
    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = ErrorClassifier.classify(error)
        
        // Si no es reintentable o es el último intento, lanzar error
        if (!this.shouldRetry(lastError, attempt)) {
          throw lastError
        }

        // Calcular delay para el siguiente intento
        const delay = this.calculateDelay(attempt)
        
        // Log del reintento (opcional)
        console.warn(`Reintentando operación ${context || 'desconocida'} (intento ${attempt}/${this.config.maxAttempts}) en ${delay}ms:`, lastError.message)
        
        await this.sleep(delay)
      }
    }

    throw lastError!
  }

  private shouldRetry(error: NotificationError, attempt: number): boolean {
    return (
      attempt < this.config.maxAttempts &&
      error.retryable &&
      this.config.retryableErrors.includes(error.type)
    )
  }

  private calculateDelay(attempt: number): number {
    const delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1)
    return Math.min(delay, this.config.maxDelay)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Generador de mensajes de error amigables
export class ErrorMessageGenerator {
  private static readonly ERROR_MESSAGES: Record<ErrorType, string> = {
    [ErrorType.NETWORK]: 'Error de conexión. Verifica tu conexión a internet.',
    [ErrorType.VALIDATION]: 'Los datos ingresados no son válidos.',
    [ErrorType.AUTHENTICATION]: 'Sesión expirada. Por favor, inicia sesión nuevamente.',
    [ErrorType.AUTHORIZATION]: 'No tienes permisos para realizar esta acción.',
    [ErrorType.SERVER]: 'Error del servidor. Intenta nuevamente en unos momentos.',
    [ErrorType.CLIENT]: 'Error en la aplicación. Recarga la página e intenta nuevamente.',
    [ErrorType.TIMEOUT]: 'La operación tardó demasiado. Intenta nuevamente.',
    [ErrorType.UNKNOWN]: 'Ocurrió un error inesperado. Intenta nuevamente.'
  }

  static generate(error: NotificationError): string {
    const baseMessage = this.ERROR_MESSAGES[error.type] || this.ERROR_MESSAGES[ErrorType.UNKNOWN]
    
    // Agregar código de error si está disponible
    if (error.code) {
      return `${baseMessage} (Código: ${error.code})`
    }

    return baseMessage
  }

  static generateWithContext(error: NotificationError, action?: string): string {
    const baseMessage = this.generate(error)
    
    if (action) {
      return `Error al ${action.toLowerCase()}: ${baseMessage}`
    }

    return baseMessage
  }
}

// Logger de errores para debugging
export class ErrorLogger {
  private static logs: NotificationError[] = []
  private static readonly MAX_LOGS = 100

  static log(error: NotificationError, context?: string) {
    const logEntry = {
      ...error,
      context: { ...error.context, logContext: context }
    }

    this.logs.unshift(logEntry as NotificationError)
    
    // Mantener solo los últimos MAX_LOGS errores
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(0, this.MAX_LOGS)
    }

    // Log en consola para desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.error('NotificationError:', logEntry)
    }
  }

  static getLogs(): NotificationError[] {
    return [...this.logs]
  }

  static getLogsByType(type: ErrorType): NotificationError[] {
    return this.logs.filter(log => log.type === type)
  }

  static clearLogs() {
    this.logs = []
  }

  static exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }
}

// Hook para manejo de errores en componentes
export function useErrorHandler() {
  const handleError = (error: unknown, context?: string) => {
    const notificationError = ErrorClassifier.classify(error)
    ErrorLogger.log(notificationError, context)
    
    const message = ErrorMessageGenerator.generateWithContext(notificationError, context)
    
    toast.error(message, {
      duration: 5000,
      className: 'toast-optimized toast-error',
      description: process.env.NODE_ENV === 'development' ? notificationError.message : undefined
    })

    return notificationError
  }

  const handleAsyncError = async (
    operation: () => Promise<any>,
    context?: string,
    retryConfig?: Partial<RetryConfig>
  ) => {
    const retryHandler = new RetryHandler(retryConfig)
    
    try {
      return await retryHandler.execute(operation, context)
    } catch (error) {
      return handleError(error, context)
    }
  }

  return {
    handleError,
    handleAsyncError,
    ErrorType,
    NotificationError
  }
}

// Instancia global del manejador de reintentos
export const globalRetryHandler = new RetryHandler()

// Función utilitaria para crear errores tipados
export function createError(
  message: string,
  type: ErrorType,
  options?: {
    code?: string
    context?: Record<string, any>
    retryable?: boolean
  }
): NotificationError {
  return new NotificationError(message, type, options)
}
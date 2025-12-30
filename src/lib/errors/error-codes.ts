/**
 * Error Codes for the Repairs Module
 * 
 * Centralized error codes for consistent error handling across the application.
 * Each code represents a specific error category that can be handled appropriately.
 */

export enum ErrorCode {
  // Authentication Errors
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  AUTH_INVALID = 'AUTH_INVALID',
  AUTH_MISSING = 'AUTH_MISSING',
  
  // Network Errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  
  // Validation Errors
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  VALIDATION_REQUIRED_FIELD = 'VALIDATION_REQUIRED_FIELD',
  VALIDATION_INVALID_FORMAT = 'VALIDATION_INVALID_FORMAT',
  
  // Server Errors
  SERVER_ERROR = 'SERVER_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  FORBIDDEN = 'FORBIDDEN',
  
  // Database Errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  DATABASE_CONNECTION_FAILED = 'DATABASE_CONNECTION_FAILED',
  
  // Unknown/Unclassified
  UNKNOWN = 'UNKNOWN'
}

/**
 * Human-readable error messages for each error code
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // Authentication
  [ErrorCode.AUTH_EXPIRED]: 'Tu sesión ha expirado. Por favor, recarga la página.',
  [ErrorCode.AUTH_INVALID]: 'Credenciales inválidas. Por favor, inicia sesión nuevamente.',
  [ErrorCode.AUTH_MISSING]: 'Se requiere autenticación para esta acción.',
  
  // Network
  [ErrorCode.NETWORK_ERROR]: 'Error de conexión. Verifica tu conexión a internet.',
  [ErrorCode.NETWORK_TIMEOUT]: 'La solicitud tardó demasiado. Intenta nuevamente.',
  
  // Validation
  [ErrorCode.VALIDATION_FAILED]: 'Los datos proporcionados no son válidos.',
  [ErrorCode.VALIDATION_REQUIRED_FIELD]: 'Faltan campos requeridos.',
  [ErrorCode.VALIDATION_INVALID_FORMAT]: 'El formato de los datos es incorrecto.',
  
  // Server
  [ErrorCode.SERVER_ERROR]: 'Error del servidor. Intenta nuevamente más tarde.',
  [ErrorCode.NOT_FOUND]: 'El recurso solicitado no fue encontrado.',
  [ErrorCode.CONFLICT]: 'Conflicto con el estado actual del recurso.',
  [ErrorCode.FORBIDDEN]: 'No tienes permisos para realizar esta acción.',
  
  // Database
  [ErrorCode.DATABASE_ERROR]: 'Error de base de datos. Contacta al soporte.',
  [ErrorCode.DATABASE_CONNECTION_FAILED]: 'No se pudo conectar a la base de datos.',
  
  // Unknown
  [ErrorCode.UNKNOWN]: 'Ocurrió un error inesperado.'
}

/**
 * Check if an error code is recoverable (can be retried)
 */
export function isRecoverableError(code: ErrorCode): boolean {
  return [
    ErrorCode.NETWORK_ERROR,
    ErrorCode.NETWORK_TIMEOUT,
    ErrorCode.SERVER_ERROR,
    ErrorCode.DATABASE_CONNECTION_FAILED
  ].includes(code)
}

/**
 * Check if an error code requires user action
 */
export function requiresUserAction(code: ErrorCode): boolean {
  return [
    ErrorCode.AUTH_EXPIRED,
    ErrorCode.AUTH_INVALID,
    ErrorCode.AUTH_MISSING,
    ErrorCode.VALIDATION_FAILED,
    ErrorCode.VALIDATION_REQUIRED_FIELD,
    ErrorCode.VALIDATION_INVALID_FORMAT
  ].includes(code)
}

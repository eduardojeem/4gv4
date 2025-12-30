/**
 * Structured Logging System
 * 
 * Provides consistent logging across the application with:
 * - Multiple log levels (debug, info, warn, error)
 * - Automatic sanitization of sensitive data
 * - Environment-aware output
 * - Structured log format
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  data?: unknown
  context?: unknown
}

/**
 * Sensitive field patterns to sanitize
 */
const SENSITIVE_PATTERNS = [
  /email/i,
  /phone/i,
  /password/i,
  /token/i,
  /secret/i,
  /api[_-]?key/i,
  /credit[_-]?card/i,
  /ssn/i,
  /social[_-]?security/i
]

/**
 * Check if a field name is sensitive
 */
function isSensitiveField(fieldName: string): boolean {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(fieldName))
}

/**
 * Sanitize sensitive data from an object
 */
export function sanitizeLogData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data
  }

  // Handle primitives
  if (typeof data !== 'object') {
    return data
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitizeLogData(item))
  }

  // Handle objects
  const sanitized: Record<string, unknown> = {}
  
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (isSensitiveField(key)) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogData(value)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Format a log entry for output
 */
function formatLogEntry(entry: LogEntry): string {
  const { level, message, timestamp, data, context } = entry
  
  const parts = [
    `[${timestamp}]`,
    `[${level.toUpperCase()}]`,
    message
  ]

  if (context && Object.keys(context).length > 0) {
    parts.push(`Context: ${JSON.stringify(context)}`)
  }

  if (data !== undefined) {
    parts.push(`Data: ${JSON.stringify(data, null, 2)}`)
  }

  return parts.join(' ')
}

/**
 * Determine if logs should be output based on environment and level
 */
function shouldLog(level: LogLevel): boolean {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const isTest = process.env.NODE_ENV === 'test'

  // Don't log in test environment unless explicitly enabled
  if (isTest && !process.env.ENABLE_TEST_LOGS) {
    return false
  }

  // In production, only log warnings and errors
  if (!isDevelopment && (level === 'debug' || level === 'info')) {
    return false
  }

  return true
}

/**
 * Output a log entry to the appropriate destination
 */
function outputLog(entry: LogEntry) {
  if (!shouldLog(entry.level)) {
    return
  }

  const formatted = formatLogEntry(entry)

  switch (entry.level) {
    case 'debug':
      console.debug(formatted)
      break
    case 'info':
      console.info(formatted)
      break
    case 'warn':
      console.warn(formatted)
      break
    case 'error':
      console.error(formatted)
      break
  }

  // In production, you could send to external service here
  // Example: sendToLogService(entry)
}

/**
 * Create a log entry
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  data?: unknown,
  context?: unknown
): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    data: data !== undefined ? sanitizeLogData(data) : undefined,
    context: context ? sanitizeLogData(context) : undefined
  }
}

/**
 * Structured logger with multiple levels
 */
export const logger = {
  /**
   * Log debug information (development only)
   */
  debug(message: string, data?: unknown, context?: unknown) {
    const entry = createLogEntry('debug', message, data, context)
    outputLog(entry)
  },

  /**
   * Log informational messages
   */
  info(message: string, data?: unknown, context?: unknown) {
    const entry = createLogEntry('info', message, data, context)
    outputLog(entry)
  },

  /**
   * Log warning messages
   */
  warn(message: string, data?: unknown, context?: unknown) {
    const entry = createLogEntry('warn', message, data, context)
    outputLog(entry)
  },

  /**
   * Log error messages
   */
  error(message: string, data?: any, context?: Record<string, any>) {
    const entry = createLogEntry('error', message, data, context)
    outputLog(entry)
  }
}

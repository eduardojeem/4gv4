import DOMPurify from 'dompurify'

/**
 * Configuración de DOMPurify para sanitización segura
 */
const PURIFY_CONFIG = {
  ALLOWED_TAGS: [], // No permitir ningún tag HTML
  ALLOWED_ATTR: [], // No permitir ningún atributo
  KEEP_CONTENT: true, // Mantener el contenido de texto
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  RETURN_DOM_IMPORT: false
}

/**
 * Sanitiza un string removiendo HTML y scripts peligrosos
 */
export function sanitizeHTML(dirty: string): string {
  if (typeof window === 'undefined') {
    // En servidor, usar sanitización básica
    return sanitizeServerSide(dirty)
  }
  
  // En cliente, usar DOMPurify
  return DOMPurify.sanitize(dirty, PURIFY_CONFIG)
}

/**
 * Sanitización del lado del servidor (sin DOM)
 */
function sanitizeServerSide(str: string): string {
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remover scripts
    .replace(/<[^>]*>/g, '') // Remover tags HTML
    .replace(/javascript:/gi, '') // Remover javascript: URLs
    .replace(/on\w+\s*=/gi, '') // Remover event handlers
    .trim()
}

/**
 * Sanitiza un objeto recursivamente
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized = {} as T
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key as keyof T] = sanitizeHTML(value) as any
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key as keyof T] = sanitizeObject(value)
    } else {
      sanitized[key as keyof T] = value
    }
  }
  
  return sanitized
}

/**
 * Valida que un archivo sea JSON válido y no exceda el tamaño máximo
 */
export function validateJSONFile(file: File, maxSizeMB: number = 1): {
  valid: boolean
  error?: string
} {
  // Validar tipo
  if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
    return {
      valid: false,
      error: 'Solo se permiten archivos JSON'
    }
  }
  
  // Validar tamaño
  const maxBytes = maxSizeMB * 1024 * 1024
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `El archivo no puede exceder ${maxSizeMB}MB`
    }
  }
  
  return { valid: true }
}

/**
 * Previene prototype pollution
 */
export function preventPrototypePollution<T>(obj: any): T {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  
  // Remover propiedades peligrosas
  const dangerous = ['__proto__', 'constructor', 'prototype']
  const cleaned = Array.isArray(obj) ? [] : {}
  
  for (const key in obj) {
    if (dangerous.includes(key)) {
      continue
    }
    
    if (obj.hasOwnProperty(key)) {
      (cleaned as any)[key] = preventPrototypePollution(obj[key])
    }
  }
  
  return cleaned as T
}

/**
 * Escapa caracteres especiales para prevenir XSS
 */
export function escapeHTML(str: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  }
  
  return str.replace(/[&<>"'/]/g, (char) => map[char])
}

/**
 * Valida que un string no contenga SQL injection
 */
export function containsSQLInjection(str: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
    /(--|\*\/|\/\*)/g,
    /(\bOR\b.*=.*)/gi,
    /(\bAND\b.*=.*)/gi,
    /(;|\||&&)/g
  ]
  
  return sqlPatterns.some(pattern => pattern.test(str))
}

/**
 * Valida que un string no contenga XSS
 */
export function containsXSS(str: string): boolean {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi
  ]
  
  return xssPatterns.some(pattern => pattern.test(str))
}

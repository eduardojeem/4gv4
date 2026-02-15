import DOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'

/**
 * Utilidades para sanitización de HTML y prevención de XSS
 */

// Crear instancia de DOMPurify para Node.js
const window = new JSDOM('').window
const purify = DOMPurify(window as unknown as Window)

/**
 * Configuración de sanitización
 */
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [], // No permitir ningún tag HTML
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true, // Mantener el contenido de texto
}

/**
 * Sanitiza una cadena de texto removiendo HTML y scripts
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') {
    return ''
  }

  // Remover HTML tags y scripts
  const sanitized = purify.sanitize(text, SANITIZE_CONFIG)
  
  // Trim y normalizar espacios
  return sanitized.trim().replace(/\s+/g, ' ')
}

/**
 * Sanitiza un objeto recursivamente
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized = {} as T

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key as keyof T] = sanitizeText(value) as T[keyof T]
    } else if (Array.isArray(value)) {
      sanitized[key as keyof T] = value.map(item => 
        typeof item === 'string' ? sanitizeText(item) : 
        typeof item === 'object' ? sanitizeObject(item) : 
        item
      ) as T[keyof T]
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key as keyof T] = sanitizeObject(value) as T[keyof T]
    } else {
      sanitized[key as keyof T] = value
    }
  }

  return sanitized
}

/**
 * Sanitiza configuración del sitio web
 */
export function sanitizeWebsiteSettings(settings: any): any {
  return sanitizeObject(settings)
}

/**
 * Valida que una cadena no contenga scripts o HTML peligroso
 */
export function containsDangerousContent(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false
  }

  const dangerous = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // onclick, onerror, etc.
    /<iframe/i,
    /<object/i,
    /<embed/i,
  ]

  return dangerous.some(pattern => pattern.test(text))
}

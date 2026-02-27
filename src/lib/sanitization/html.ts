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
 * Sanitiza recursivamente cualquier valor (objeto, array o primitivo)
 */
export function sanitizeValue(value: any): any {
  if (typeof value === 'string') {
    return sanitizeText(value)
  }
  
  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item))
  }
  
  if (typeof value === 'object' && value !== null) {
    const sanitized: Record<string, any> = {}
    for (const [k, v] of Object.entries(value)) {
      sanitized[k] = sanitizeValue(v)
    }
    return sanitized
  }
  
  return value
}

/**
 * Sanitiza un objeto recursivamente (Mantenida por compatibilidad)
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  return sanitizeValue(obj) as T
}

/**
 * Sanitiza configuración del sitio web
 */
export function sanitizeWebsiteSettings(settings: any): any {
  return sanitizeValue(settings)
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

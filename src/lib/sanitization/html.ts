/**
 * Utilidades para sanitización de HTML y prevención de XSS.
 *
 * La política es "remover TODO el HTML, conservar el texto" (no se permite ningún
 * tag), así que se implementa sin jsdom/DOMPurify — esas dependencias pesadas son
 * frágiles en runtimes serverless y provocaban fallos al inicializar el módulo.
 */

const NAMED_ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&nbsp;': ' ',
}

/**
 * Sanitiza una cadena de texto removiendo HTML y scripts, conservando el texto.
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') {
    return ''
  }

  const sanitized = text
    // Remover bloques peligrosos con su contenido
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    // Remover cualquier otro tag HTML (conservando su contenido de texto)
    .replace(/<[^>]*>/g, '')
    // Decodificar entidades comunes para no dejar texto distorsionado
    .replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&#x27;|&nbsp;/gi, (m) => NAMED_ENTITIES[m.toLowerCase()] ?? m)

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

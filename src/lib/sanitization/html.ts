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

  // Espacios de más se juntan, pero los saltos de línea quedan: juntar todo en un
  // solo espacio convertía instrucciones de transferencia, avisos y mensajes de
  // varias líneas en un renglón. Tres o más saltos seguidos quedan en dos.
  return sanitized
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Sanitiza recursivamente cualquier valor (objeto, array o primitivo)
 */
export function sanitizeValue<T>(value: T): T {
  if (typeof value === 'string') {
    return sanitizeText(value) as unknown as T
  }
  
  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item)) as unknown as T
  }
  
  if (typeof value === 'object' && value !== null) {
    const sanitized: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      sanitized[k] = sanitizeValue(v)
    }
    return sanitized as unknown as T
  }
  
  return value
}

/**
 * Sanitiza un objeto recursivamente (Mantenida por compatibilidad)
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  return sanitizeValue(obj)
}

/**
 * Sanitiza configuración del sitio web
 */
export function sanitizeWebsiteSettings<T>(settings: T): T {
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

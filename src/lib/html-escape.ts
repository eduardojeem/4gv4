/**
 * Escapado para los comprobantes que se arman como texto HTML.
 *
 * Los tickets se escriben en una ventana del mismo origen que la app: un nombre
 * de cliente o de producto como `<img src=x onerror=...>` ejecutaba codigo con
 * la sesion de quien imprimia.
 */
const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char])

/** Escapa todos los textos de un objeto, sin tocar numeros, fechas ni booleanos. */
export function escapeHtmlDeep<T>(value: T): T {
  if (typeof value === 'string') return escapeHtml(value) as T
  if (Array.isArray(value)) return value.map(escapeHtmlDeep) as T
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, escapeHtmlDeep(item)])
    ) as T
  }
  return value
}

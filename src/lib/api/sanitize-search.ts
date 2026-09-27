/**
 * Strips characters that PostgREST treats as control syntax inside filter
 * strings (`.or(...)`, `.filter(...)`, LIKE patterns).
 *
 * Interpolating a raw query param into `.or('col.ilike.%term%,...')` lets a
 * caller close the current condition and append arbitrary ones — commas
 * separate filters, parentheses group them, and `%`/`_` are LIKE wildcards.
 * Always run user-supplied search terms through this before building such a
 * string.
 */
export function sanitizeSearchTerm(value: string | null | undefined, maxLength = 120) {
  if (!value) return ''
  return value.replace(/[.,()!<>=&|%_:*\\]/g, '').trim().slice(0, maxLength)
}

/**
 * Variante para columnas donde el punto, el guion bajo y la barra son parte del
 * dato: direcciones IP, acciones en snake_case, rutas de API, identificadores.
 *
 * `sanitizeSearchTerm` los borra, que esta bien para buscar nombres o correos
 * —sus cinco llamadores— pero inutiliza el buscador del registro de auditoria:
 * "192.168.1.10" queda en "192168110" y
 * "unauthorized_admin_access_attempt" en "unauthorizedadminaccessattempt".
 *
 * Se saca solo lo que puede romper la gramatica de un filtro de PostgREST o
 * ensanchar la coincidencia: la coma separa condiciones, los parentesis las
 * agrupan, la comilla y la barra invertida citan y escapan, y `%` y `*` son
 * comodines de LIKE. El punto no hace falta sacarlo: la sintaxis
 * `columna.operador.valor` parte en los dos primeros, y el resto es el valor.
 */
export function sanitizeFilterTerm(value: string | null | undefined, maxLength = 120) {
  if (!value) return ''
  return value.replace(/[,()"%*\\]/g, '').trim().slice(0, maxLength)
}

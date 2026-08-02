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

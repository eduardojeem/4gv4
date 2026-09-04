import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sanitizeFilterTerm, sanitizeSearchTerm } from './sanitize-search'

describe('sanitizeSearchTerm', () => {
  it('keeps ordinary search text usable', () => {
    expect(sanitizeSearchTerm('Maria Lopez')).toBe('Maria Lopez')
    expect(sanitizeSearchTerm('  jose  ')).toBe('jose')
  })

  it('strips the characters that close a PostgREST filter', () => {
    // Without stripping, the comma would end the `ilike` condition and the rest
    // would be parsed as an additional filter.
    const injected = 'x,role.eq.super_admin'
    expect(sanitizeSearchTerm(injected)).toBe('xroleeqsuper_admin'.replace('_', ''))
    expect(sanitizeSearchTerm(injected)).not.toContain(',')
    expect(sanitizeSearchTerm(injected)).not.toContain('.')
  })

  it('strips LIKE wildcards so a term cannot match everything', () => {
    expect(sanitizeSearchTerm('%')).toBe('')
    expect(sanitizeSearchTerm('_')).toBe('')
    expect(sanitizeSearchTerm('a%b_c')).toBe('abc')
  })

  it('strips grouping and boolean operators', () => {
    expect(sanitizeSearchTerm('(a|b)&c')).toBe('abc')
    expect(sanitizeSearchTerm('a>b<c=d')).toBe('abcd')
  })

  it('caps the length', () => {
    expect(sanitizeSearchTerm('a'.repeat(500))).toHaveLength(120)
    expect(sanitizeSearchTerm('a'.repeat(500), 10)).toHaveLength(10)
  })

  it('handles null and undefined', () => {
    expect(sanitizeSearchTerm(null)).toBe('')
    expect(sanitizeSearchTerm(undefined)).toBe('')
    expect(sanitizeSearchTerm('')).toBe('')
  })
})

/**
 * El buscador del registro de auditoría interpolaba el término del usuario
 * dentro de un `.or(...)` de PostgREST escapando `%`, `_` y la coma con barra
 * invertida. Los paréntesis —que agrupan condiciones— pasaban tal cual.
 *
 * El helper general del proyecto resolvía eso, pero borra el punto y el guion
 * bajo: aplicarlo sin más habría cambiado un riesgo por una búsqueda inservible.
 */
describe('sanitizeFilterTerm', () => {
  it('saca lo que puede romper la gramática del filtro', () => {
    // La coma separa condiciones y los paréntesis las agrupan: con ellos dentro
    // del valor, el término deja de ser un valor.
    expect(sanitizeFilterTerm('foo),bar')).toBe('foobar')
    expect(sanitizeFilterTerm('a(b)c')).toBe('abc')
    expect(sanitizeFilterTerm('x"y')).toBe('xy')
    expect(sanitizeFilterTerm('x\\y')).toBe('xy')
  })

  it('saca los comodines para que la búsqueda no se ensanche sola', () => {
    expect(sanitizeFilterTerm('%')).toBe('')
    expect(sanitizeFilterTerm('adm*n')).toBe('admn')
  })

  it('conserva lo que en este registro ES el dato', () => {
    // Estas cuatro son las búsquedas naturales de una pantalla de seguridad.
    expect(sanitizeFilterTerm('192.168.1.10')).toBe('192.168.1.10')
    expect(sanitizeFilterTerm('unauthorized_admin_access_attempt')).toBe('unauthorized_admin_access_attempt')
    expect(sanitizeFilterTerm('/api/admin/users')).toBe('/api/admin/users')
    expect(sanitizeFilterTerm('2001:db8::1')).toBe('2001:db8::1')
  })

  it('el helper general sí las rompería', () => {
    // Es la razón de que exista esta variante, y queda fijada acá para que nadie
    // "unifique" las dos funciones sin darse cuenta.
    expect(sanitizeSearchTerm('192.168.1.10')).toBe('192168110')
    expect(sanitizeSearchTerm('unauthorized_admin_access_attempt')).toBe('unauthorizedadminaccessattempt')
  })

  it('recorta y limpia los extremos', () => {
    expect(sanitizeFilterTerm('  hola  ')).toBe('hola')
    expect(sanitizeFilterTerm('a'.repeat(300))).toHaveLength(120)
  })

  it('tolera vacío y nulo', () => {
    expect(sanitizeFilterTerm('')).toBe('')
    expect(sanitizeFilterTerm(null)).toBe('')
    expect(sanitizeFilterTerm(undefined)).toBe('')
  })
})

describe('la ruta de seguridad usa el sanitizador', () => {
  const ruta = readFileSync(resolve(process.cwd(), 'src/app/api/admin/security/logs/route.ts'), 'utf8')

  it('ya no escapa el término a mano', () => {
    expect(ruta).not.toContain("params.search.replace(")
    expect(ruta).toContain('sanitizeFilterTerm(params.search)')
  })

  it('no arma el filtro cuando el término queda vacío', () => {
    // Un término hecho solo de caracteres retirados dejaría `ilike.%%`, que
    // coincide con todo: el buscador devolvería el registro entero.
    expect(ruta).toContain('if (!escaped) return nextQuery')
  })

  it('importa el helper del módulo compartido', () => {
    expect(ruta).toContain("from '@/lib/api/sanitize-search'")
  })
})

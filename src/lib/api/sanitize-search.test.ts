import { describe, expect, it } from 'vitest'
import { sanitizeSearchTerm } from './sanitize-search'

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

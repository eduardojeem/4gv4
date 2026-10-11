import { describe, expect, it } from 'vitest'
import { customerDirectorySearchFilter } from './directory-search'

function pattern(search: string, column: string) {
  const filter = customerDirectorySearchFilter(search).split(',').find(part => part.startsWith(`${column}.imatch.`))
  expect(filter).toBeDefined()
  return new RegExp(JSON.parse(filter!.slice(`${column}.imatch.`.length)), 'i')
}

describe('normalized customer directory search', () => {
  it('matches names with accents and repeated spaces', () => {
    expect(pattern('  Jose   Perez  ', 'name').test('José Pérez')).toBe(true)
    expect(pattern('José Pérez', 'name').test('Jose   Perez')).toBe(true)
    expect(pattern('Jose Perez', 'name').test('Maria Perez')).toBe(false)
  })
  it('matches formatted phone and document digits', () => {
    expect(pattern('0981 123-456', 'phone').test('+595 (0981) 123-456')).toBe(true)
    expect(pattern('1234567', 'ruc').test('1.234.567')).toBe(true)
    expect(pattern('1234567', 'ruc').test('1234999')).toBe(false)
  })
  it('preserves literal email punctuation', () => {
    expect(pattern('ana.perez@example.com', 'email').test('ana.perez@example.com')).toBe(true)
    expect(pattern('ana.perez@example.com', 'email').test('anaxperez@examplexcom')).toBe(false)
  })
  it('does not interpret regex or filter operators supplied by the user', () => {
    expect(pattern('.*', 'name').test('José Pérez')).toBe(false)
    expect(customerDirectorySearchFilter(' \n ')).toBe('')
    expect(customerDirectorySearchFilter('a,b)').split(',')).toHaveLength(9)
  })
})

import { describe, expect, it } from 'vitest'
import { formatDateInputLocal, formatDateOnlyDisplay, isSameLocalDate, parseDateOnlyLocal } from './date-only'

describe('date-only helpers', () => {
  it('parses date input values as local calendar dates', () => {
    const date = parseDateOnlyLocal('2026-06-15')

    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(5)
    expect(date.getDate()).toBe(15)
  })

  it('keeps the input date stable when formatting for date inputs', () => {
    expect(formatDateInputLocal('2026-06-15')).toBe('2026-06-15')
  })

  it('compares date-only values by local day', () => {
    expect(isSameLocalDate('2026-06-15', new Date(2026, 5, 15, 23, 30))).toBe(true)
  })

  it('formats labels without shifting date-only values to the previous day', () => {
    const label = formatDateOnlyDisplay('2026-06-15', 'es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })

    expect(label).toContain('15')
    expect(label).toContain('2026')
  })
})

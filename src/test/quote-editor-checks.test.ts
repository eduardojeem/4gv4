import { describe, expect, it } from 'vitest'
import { findQuoteIssues } from '@/lib/quotes/quote-editor-checks'

describe('qué le falta a un presupuesto', () => {
  it('pide cliente e ítems en uno vacío', () => {
    expect(findQuoteIssues('', []).map((issue) => issue.kind)).toEqual(['customer', 'no_lines'])
  })

  it('no deja guardar una línea libre sin descripción', () => {
    const issues = findQuoteIssues('Juan', [
      { description: 'Corte', quantity: 1, unit_price: 50000 },
      { description: '  ', quantity: 1, unit_price: 0 },
    ])
    expect(issues).toEqual([
      { kind: 'empty_description', message: 'La línea 2 no tiene descripción', line: 1, blocking: true },
    ])
  })

  it('avisa del precio en cero sin bloquear: puede ser una cortesía', () => {
    const [issue] = findQuoteIssues('Juan', [{ description: 'Diagnóstico', quantity: 1, unit_price: 0 }])
    expect(issue).toMatchObject({ kind: 'zero_price', blocking: false, line: 0 })
  })

  it('un presupuesto completo no tiene pendientes', () => {
    expect(findQuoteIssues('Juan', [{ description: 'Corte', quantity: 2, unit_price: 50000 }])).toEqual([])
  })
})

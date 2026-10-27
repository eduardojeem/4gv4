import { describe, expect, it } from 'vitest'

import { formatQuoteAmount, quoteCode, quoteStatusLabel } from '../../../mobile/src/lib/quote-display'

describe('mobile quote display', () => {
  it('formats quote numbers consistently with the web section', () => {
    expect(quoteCode(7)).toBe('P-00007')
  })

  it('formats the quote amount with its stored currency', () => {
    expect(formatQuoteAmount(12000, 'PYG')).toContain('12.000')
    expect(formatQuoteAmount(12, 'USD')).toContain('12')
  })

  it('maps every persisted status to a user-facing label', () => {
    expect(quoteStatusLabel('draft')).toBe('Borrador')
    expect(quoteStatusLabel('sent')).toBe('Enviado')
    expect(quoteStatusLabel('accepted')).toBe('Aceptado')
    expect(quoteStatusLabel('rejected')).toBe('Rechazado')
    expect(quoteStatusLabel('converted')).toBe('Vendido')
    expect(quoteStatusLabel('cancelled')).toBe('Anulado')
  })
})

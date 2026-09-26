import { describe, expect, it } from 'vitest'
import {
  appendClause,
  clampWarrantyMonths,
  formatWarrantyMonths,
  hasClause,
  resolveWarranty,
  WARRANTY_NOTES_MAX,
  warrantyMonthOptions,
} from './warranty'

const TALLER = {
  defaultWarrantyMonths: 3,
  defaultWarrantyType: 'full' as const,
  defaultWarrantyNotes: 'No cubre golpes.',
}

describe('la garantía que se imprime', () => {
  /**
   * `0 || predeterminada` convertía «sin garantía» en la del taller: las
   * órdenes del modo rápido salían impresas con 3 meses que nadie dio.
   */
  it('una orden sin garantía sigue sin garantía', () => {
    const resuelta = resolveWarranty({ warrantyMonths: 0, warrantyType: 'full', warrantyNotes: 'algo viejo' }, TALLER)
    expect(resuelta.months).toBe(0)
    expect(resuelta.notes).toBe('')
    expect(resuelta.fromDefault).toBe(false)
  })

  it('la orden manda sobre la del taller', () => {
    expect(resolveWarranty({ warrantyMonths: 6, warrantyType: 'parts', warrantyNotes: '' }, TALLER)).toEqual({
      months: 6, type: 'parts', notes: '', fromDefault: false,
    })
  })

  it('solo si la orden no dice nada se usa la del taller', () => {
    expect(resolveWarranty({}, TALLER)).toEqual({ months: 3, type: 'full', notes: 'No cubre golpes.', fromDefault: true })
    expect(resolveWarranty({ warrantyMonths: null }, TALLER).fromDefault).toBe(true)
  })

  it('un tipo desconocido cae al del taller en vez de imprimirse cualquier cosa', () => {
    expect(resolveWarranty({ warrantyMonths: 3, warrantyType: 'total' }, TALLER).type).toBe('full')
  })
})

describe('la duración', () => {
  it('se acota a meses enteros de 0 a 36', () => {
    expect(clampWarrantyMonths(40)).toBe(36)
    expect(clampWarrantyMonths(-3)).toBe(0)
    expect(clampWarrantyMonths('2.7')).toBe(2)
    expect(clampWarrantyMonths('', 5)).toBe(5)
    expect(clampWarrantyMonths('abc', 3)).toBe(3)
  })

  it('se nombra igual en todas las pantallas', () => {
    expect(formatWarrantyMonths(0)).toBe('Sin garantía')
    expect(formatWarrantyMonths(1)).toBe('1 mes')
    expect(formatWarrantyMonths(6)).toBe('6 meses')
    expect(formatWarrantyMonths(12)).toBe('1 año')
    expect(formatWarrantyMonths(24)).toBe('2 años')
    expect(formatWarrantyMonths(18)).toBe('18 meses')
  })

  /** Con una política de 2 meses, el selector del formulario quedaba en blanco. */
  it('el selector incluye el valor actual aunque no sea habitual', () => {
    expect(warrantyMonthOptions(2)).toContain(2)
    expect(warrantyMonthOptions(9)).toEqual([0, 1, 3, 6, 9, 12, 24, 36])
    expect(warrantyMonthOptions(3)).toEqual([0, 1, 3, 6, 12, 24, 36])
  })
})

describe('las cláusulas', () => {
  it('reconoce una cláusula aunque cambien viñetas, tildes o puntuación', () => {
    const notas = '• aplica UNICAMENTE a la pieza sustituida\n• Otra cosa.'
    expect(hasClause(notas, 'Aplica únicamente a la pieza sustituida.')).toBe(true)
    expect(hasClause(notas, 'No cubre daños por humedad, agua o líquidos.')).toBe(false)
  })

  it('no la agrega dos veces', () => {
    const una = appendClause('', 'No cubre golpes.')
    expect(una).toBe('• No cubre golpes.')
    expect(appendClause(una, 'No cubre golpes.')).toBe(una)
    expect(appendClause(una, 'Conserve este comprobante.')).toBe('• No cubre golpes.\n• Conserve este comprobante.')
  })

  it('no pasa el tope de caracteres', () => {
    const casiLleno = 'x'.repeat(WARRANTY_NOTES_MAX - 5)
    expect(appendClause(casiLleno, 'Una cláusula larga que no entra.')).toBe(casiLleno)
  })
})

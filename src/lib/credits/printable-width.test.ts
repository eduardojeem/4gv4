import { describe, expect, it } from 'vitest'
import { CREDIT_PRINTABLE_FITS, CREDIT_PRINTABLE_WIDTH_MM, creditPrintableWidthMm, getCreditPaperMetrics } from './paper'
import { getCreditPaymentReceiptTarget } from './payment-receipt'

/**
 * Las térmicas imprimen menos que el ancho del papel: 80 mm imprime unos 72 y
 * 58 mm unos 48. El contenido tiene que quedar centrado y adentro de eso.
 */
describe('ancho imprimible de los comprobantes de crédito', () => {
  for (const format of ['80mm', '58mm'] as const) {
    const printable = format === '80mm' ? 72 : 48
    for (const fit of CREDIT_PRINTABLE_FITS) {
      it(`${format} ${fit}: centrado y dentro de los ${printable} mm imprimibles`, () => {
        const target = getCreditPaymentReceiptTarget(format, undefined, fit)
        expect(target.contentWidthMm).toBe(CREDIT_PRINTABLE_WIDTH_MM[format][fit])
        expect(target.contentWidthMm).toBeLessThanOrEqual(printable)
        const right = target.pageWidthMm - target.contentLeftMm - target.contentWidthMm
        expect(right).toBeCloseTo(target.contentLeftMm, 5)
        expect(target.labelColumnWidth + target.valueColumnWidth).toBeCloseTo(target.contentWidthMm, 5)
      })
    }

    it(`${format}: el estado de cuenta usa el mismo ancho seguro`, () => {
      const metrics = getCreditPaperMetrics(format)
      expect(metrics.contentWidthMm).toBe(creditPrintableWidthMm(format, 'standard'))
      expect(metrics.marginMm * 2 + metrics.contentWidthMm).toBeCloseTo(metrics.pageWidthMm, 5)
    })
  }

  it('un papel fuera de lo común se escala y nunca pasa el papel menos 3 mm por lado', () => {
    expect(creditPrintableWidthMm('80mm', 'standard', 76)).toBeCloseTo(70 * 76 / 80, 5)
    expect(creditPrintableWidthMm('58mm', 'standard', 50)).toBeLessThanOrEqual(44)
  })
})

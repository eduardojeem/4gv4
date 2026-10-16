import type { jsPDF } from 'jspdf'
import type { CreditPaymentReceiptRenderTarget } from './payment-receipt'

// Below jsPDF's 14,400-point page limit (5,080 mm).
const MEASUREMENT_HEIGHT_MM = 5000

/** Measure with the same fonts, wrapping and tables used by the final receipt. */
export async function createReceiptDocument(
  target: CreditPaymentReceiptRenderTarget,
  draw: (doc: jsPDF) => number,
): Promise<jsPDF> {
  const { default: JsPDF } = await import('jspdf')
  if (target.isSheet) {
    const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    draw(doc)
    return doc
  }

  const measurement = new JsPDF({ orientation: 'portrait', unit: 'mm', format: [target.pageWidthMm, MEASUREMENT_HEIGHT_MM] })
  const height = Math.ceil(draw(measurement))
  if (measurement.getNumberOfPages() !== 1 || height > MEASUREMENT_HEIGHT_MM) {
    throw new Error('El comprobante supera el largo máximo del rollo. Seleccioná A4 para imprimirlo completo.')
  }
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: [target.pageWidthMm, Math.max(target.pageWidthMm + 1, height)] })
  draw(doc)
  return doc
}

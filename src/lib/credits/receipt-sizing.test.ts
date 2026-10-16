// @vitest-environment node
import { expect, it } from 'vitest'
import { createCreditPaymentReceiptPdf } from './payment-receipt'
import { createGlobalPaymentReceiptPdf } from './global-payment-receipt'

for (const format of ['58mm', '80mm', 'A4'] as const) {
  for (const long of [false, true]) {
    it(`sizes both receipts from their rendered content: ${format}, long=${long}`, async () => {
      const issuer = {
        businessName: long ? 'COMERCIAL DE PRUEBA '.repeat(12) : 'Comercial prueba',
        businessAddress: long ? 'Avenida principal y calle secundaria '.repeat(15) : 'Calle 123',
        customerName: 'Cliente prueba',
        notes: long ? 'Observación de la operación '.repeat(35) : 'Pago de cuota',
      }
      const results = await Promise.all([
        createCreditPaymentReceiptPdf({ ...issuer, paymentId: 'audit', creditId: 'credit', paymentAmount: 150000, currentCreditBalance: 1350000, totalCreditAmount: 1800000 }, { format }),
        createGlobalPaymentReceiptPdf({ ...issuer, receiptNumber: 'ABN-1', paidAt: '2026-10-15', totalAmount: 150000, paymentMethod: 'cash', allocations: [{ id: 'i1', type: 'installment', title: long ? 'Credito con detalle de venta y descripcion extensa '.repeat(6) : 'Cuota 1', allocatedAmount: 150000, totalAmount: 1800000, newPending: 1350000 }], excessToStoreCredit: 0 }, { format }),
      ])
      for (const { doc } of results) {
        const pdf = doc.output()
        expect(pdf).toContain('Firma / Sello de cobranza')
        expect(pdf).toContain('Gracias por su pago.')
        expect(doc.internal.pageSize.getWidth()).toBeCloseTo(format === 'A4' ? 210 : parseInt(format), 1)
        if (format !== 'A4') {
          expect(doc.getNumberOfPages()).toBe(1)
          const bottom = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
          const remaining = doc.internal.pageSize.getHeight() - bottom
          expect(remaining).toBeGreaterThan(15)
          expect(remaining).toBeLessThan(45)
        } else {
          expect(doc.internal.pageSize.getHeight()).toBeCloseTo(297, 1)
        }
      }
    })
  }
}

it('offers A4 instead of silently truncating a receipt beyond the PDF page limit', async () => {
  await expect(createCreditPaymentReceiptPdf({
    paymentId: 'oversized', creditId: 'credit', customerName: 'Cliente prueba', paymentAmount: 1,
    notes: 'Observacion de la operacion '.repeat(1500),
  }, { format: '58mm' })).rejects.toThrow('Seleccioná A4')
})

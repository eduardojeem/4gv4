import { describe, expect, it } from 'vitest'
import {
  CREDIT_PAYMENT_RECEIPT_HEIGHT_MM,
  CREDIT_PAYMENT_RECEIPT_WIDTH_MM,
  buildCreditPaymentReceiptNumber,
  getCreditCurrentBalance,
  getCreditPaymentReceiptHeight,
  getCreditPaymentReceiptLayout,
  getCreditPaymentMethodLabel,
} from './payment-receipt'

describe('credit payment receipt helpers', () => {
  it('formats known payment methods for receipts', () => {
    expect(getCreditPaymentMethodLabel('cash')).toBe('Efectivo')
    expect(getCreditPaymentMethodLabel('card')).toBe('Tarjeta')
    expect(getCreditPaymentMethodLabel('transfer')).toBe('Transferencia')
  })

  it('keeps unknown payment methods visible instead of dropping them', () => {
    expect(getCreditPaymentMethodLabel('wallet')).toBe('wallet')
    expect(getCreditPaymentMethodLabel(null)).toBe('No especificado')
  })

  it('builds a stable receipt number from the payment id', () => {
    expect(buildCreditPaymentReceiptNumber('3d676bb8-9012-4d93-9a8c-abcdef123456')).toBe('REC-3D676BB890')
  })

  it('uses ticket receipt dimensions compatible with POS printers', () => {
    expect(CREDIT_PAYMENT_RECEIPT_WIDTH_MM).toBe(80)
    expect(CREDIT_PAYMENT_RECEIPT_HEIGHT_MM).toBe(220)
  })

  it('keeps receipt columns inside the printable width', () => {
    const layout = getCreditPaymentReceiptLayout(80)

    expect(layout.margin * 2 + layout.labelColumnWidth + layout.valueColumnWidth).toBeLessThanOrEqual(80)
  })

  it('compacts receipt typography for narrow printers', () => {
    const narrow = getCreditPaymentReceiptLayout(58)
    const standard = getCreditPaymentReceiptLayout(80)

    expect(narrow.tableBodyFontSize).toBeLessThan(standard.tableBodyFontSize)
    expect(narrow.margin).toBeLessThan(standard.margin)
  })

  it('expands ticket height when receipt content is long', () => {
    const height = getCreditPaymentReceiptHeight({
      paymentId: 'payment-long',
      paymentAmount: 100000,
      paymentMethod: 'cash',
      customerName: 'Cliente con nombre completo extremadamente largo para probar el ajuste de impresion',
      customerId: 'customer-1',
      creditId: 'credit-1',
      creditLabel: 'Credito con descripcion amplia y varios detalles comerciales',
      productSummary: 'Telefono principal con accesorios, garantia extendida, observaciones de venta y detalle suficientemente largo para ocupar varias lineas dentro del ticket impreso. '.repeat(8),
      notes: 'Pago registrado con observaciones largas para verificar que el comprobante no corte la parte final cuando se imprime en impresora termica. '.repeat(8),
      currentCreditBalance: 0,
    })

    expect(height).toBeGreaterThan(CREDIT_PAYMENT_RECEIPT_HEIGHT_MM)
  })

  it('calculates current credit balance from installment outstanding amounts', () => {
    const installments = [
      { credit_id: 'credit-a', amount: 100, amount_paid: 100 },
      { credit_id: 'credit-a', amount: 200, amount_paid: 50 },
      { credit_id: 'credit-a', amount: 300, amount_paid: null },
      { credit_id: 'credit-b', amount: 999, amount_paid: 0 },
    ]

    expect(getCreditCurrentBalance(installments, 'credit-a')).toBe(450)
  })
})

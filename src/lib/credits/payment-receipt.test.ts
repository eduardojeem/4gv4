import { describe, expect, it } from 'vitest'
import {
  CREDIT_PAYMENT_RECEIPT_HEIGHT_MM,
  CREDIT_PAYMENT_RECEIPT_WIDTH_MM,
  buildCreditPaymentReceiptNumber,
  getCreditCurrentBalance,
  getCreditPaymentReceiptHeight,
  getCreditPaymentReceiptLayout,
  getCreditPaymentMethodLabel,
  buildPaymentDetailRows,
  buildAccountStatusRows,
  buildInstallmentPlanRows,
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

  it('includes installment number and remaining debt in receipt rows', () => {
    const paymentRows = buildPaymentDetailRows({
      paymentId: 'pay-1',
      paymentAmount: 250000,
      paymentMethod: 'cash',
      installmentNumber: 2,
      totalInstallments: 6,
      installmentDueDate: '2026-09-01',
      installmentAmount: 250000,
    })

    // La posicion de la cuota y las que faltan se mudaron a la seccion "PLAN DE
    // CUOTAS": antes estaban repartidas entre el detalle del pago y el estado de
    // cuenta, y el comprobante decia lo mismo dos veces. Aca queda lo que es
    // estrictamente del pago.
    expect(paymentRows).toEqual(
      expect.arrayContaining([
        ['Valor Cuota', expect.stringContaining('250.000')],
        ['MONTO ABONADO', expect.stringContaining('250.000')],
        ['Método de Pago', 'Efectivo'],
      ])
    )
    expect(paymentRows.some(([etiqueta]) => etiqueta === 'Cuota Pagada')).toBe(false)

    const planRows = buildInstallmentPlanRows({
      paymentId: 'pay-1',
      paymentAmount: 250000,
      customerName: 'Cliente',
      creditId: 'cred-1',
      installmentNumber: 2,
      totalInstallments: 6,
      paidInstallmentsCount: 2,
    })

    expect(planRows).toEqual(
      expect.arrayContaining([
        ['CUOTA ABONADA', '2 de 6'],
        ['Cuotas que faltan', '4 cuotas'],
      ])
    )

    const statusRows = buildAccountStatusRows({
      paymentId: 'pay-1',
      paymentAmount: 250000,
      currentCreditBalance: 1000000,
      pendingInstallmentsCount: 4,
      nextDueDate: '2026-10-01',
      nextDueAmount: 250000,
    })

    expect(statusRows).toEqual(
      expect.arrayContaining([
        ['SALDO PENDIENTE (FALTA)', expect.stringContaining('1.000.000')],
      ])
    )
  })
})

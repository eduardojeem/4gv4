import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }))

import { buildReceiptShareText, receiptWhatsAppHref, shareReceipt, whatsappNumber, type ReceiptData } from '@/lib/receipt-utils'
import { buildInstallmentPaymentText, installmentPaymentHtml, installmentPaymentWhatsAppHref } from '@/lib/credits/installment-payment-receipt'
import { sharePdfDocument } from '@/lib/credits/print-receipt'

const receipt: ReceiptData = {
  receiptNumber: 'T-0042', date: '10/10/2026', time: '15:30', cashier: 'Ana',
  customer: { name: 'Juan', phone: '0981 123 456', email: '' },
  items: [{ id: '1', name: 'Pomada', sku: 'P1', price: 50_000, quantity: 2 }],
  subtotal: 100_000, totalDiscount: 0, tax: 0, total: 100_000,
  payments: [{ id: 'p', method: 'cash', amount: 120_000 }], change: 20_000,
}

afterEach(() => vi.unstubAllGlobals())

describe('ticket de venta en texto y por WhatsApp', () => {
  it('lleva productos, total, cómo pagó y el vuelto', () => {
    const text = buildReceiptShareText(receipt, 'JE Sentrix')
    expect(text).toContain('*JE Sentrix*')
    expect(text).toContain('2 × Pomada')
    expect(text).toMatch(/\*Total: .*100\.000\*/)
    expect(text).toMatch(/Efectivo: .*120\.000/)
    expect(text).toMatch(/Vuelto: .*20\.000/)
    expect(text).toContain('Hola Juan')
    expect(text).toContain('✅ *PAGADO*')
  })

  it('a crédito muestra total financiado, cuotas y saldo, sin la línea de crédito como pago', () => {
    const text = buildReceiptShareText({
      ...receipt,
      change: undefined,
      payments: [{ id: 'c', method: 'credit', amount: 100_000 }],
      creditInfo: {
        baseTotal: 100_000, interestAmount: 20_000, financedTotal: 120_000,
        installmentCount: 6, installmentAmount: 20_000, frequency: 'monthly', interestRate: 20,
        firstDueDate: '2026-11-10',
      },
    }, { name: 'JE', phone: '021 555 000' })
    expect(text).toMatch(/Total financiado: .*120\.000/)
    expect(text).toMatch(/6 cuotas mensuales de .*20\.000/)
    expect(text).toMatch(/\*Saldo pendiente: .*120\.000\*/)
    expect(text).not.toMatch(/Crédito: .*100\.000/)
    expect(text).toContain('Consultas: 021 555 000')
  })

  it('el número de Paraguay pasa a formato internacional', () => {
    expect(whatsappNumber('0981 123 456')).toBe('595981123456')
    expect(whatsappNumber('+595 981 123456')).toBe('595981123456')
    expect(whatsappNumber('')).toBeNull()
  })

  it('va directo al cliente si tiene teléfono; si no, para elegir el contacto', () => {
    expect(receiptWhatsAppHref(receipt, 'JE')).toMatch(/^https:\/\/wa\.me\/595981123456\?text=/)
    expect(receiptWhatsAppHref({ ...receipt, customer: undefined }, 'JE')).toMatch(/^https:\/\/wa\.me\/\?text=/)
  })

  it('cerrar el menú de compartir no abre una segunda ventana ni copia nada', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError'))
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share, clipboard: { writeText } })
    await shareReceipt(receipt, { name: 'JE' } as never)
    expect(share).toHaveBeenCalledTimes(1)
    expect(writeText).not.toHaveBeenCalled()
  })

  it('sin menú de compartir, copia el ticket completo', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await shareReceipt(receipt, { name: 'JE' } as never)
    expect(writeText.mock.calls[0][0]).toContain('2 × Pomada')
  })

  it('el PDF mide lo que mide el ticket (no 297 mm fijos)', () => {
    const utils = readFileSync('src/lib/receipt-utils.ts', 'utf8')
    expect(utils).toContain('format: [imgWidth, Math.max(60, Math.ceil(imgHeight))]')
    expect(utils).not.toContain('format: [80, 297]')
  })
})

describe('comprobante de pago de cuota', () => {
  const payment = { storeName: 'JE', customerName: 'Juan', customerPhone: '0981123456', amount: 150_000, method: 'transfer', reference: 'AB12', paidAt: new Date('2026-10-10T18:00:00Z'), balanceAfter: 350_000 }

  it('el texto dice cuánto pagó, cómo y cuánto le queda', () => {
    const text = buildInstallmentPaymentText(payment)
    expect(text).toMatch(/\*Pagó: .*150\.000\*/)
    expect(text).toContain('Transferencia (ref. AB12)')
    expect(text).toMatch(/Saldo pendiente: .*350\.000/)
    expect(buildInstallmentPaymentText({ ...payment, balanceAfter: 0 })).toContain('Crédito al día')
    expect(installmentPaymentWhatsAppHref(payment)).toMatch(/^https:\/\/wa\.me\/595981123456\?text=/)
  })

  it('el ticket para imprimir escapa los datos del cliente', () => {
    expect(installmentPaymentHtml({ ...payment, customerName: '<b>Juan</b>' })).toContain('&lt;b&gt;Juan&lt;/b&gt;')
  })
  it('el ticket de un cobro confirmado conserva su identificador persistido', () => {
    expect(installmentPaymentHtml({ ...payment, receiptNumber: 'COL-PERSISTIDO' })).toContain('COL-PERSISTIDO')
  })

  it('en la caja el monto se lee en guaraníes («100.000» no es 100) y deja el comprobante', () => {
    const source = readFileSync('src/components/pos/CustomerCreditHistory.tsx', 'utf8')
    expect(source).toContain('parseThousands(paymentAmount)')
    expect(source).toContain('amount: success.appliedAmount')
    expect(source).not.toContain('parseFloat(paymentAmount)')
    expect(source).toContain('setLastPayment({')
  })
})

describe('compartir el PDF de un pago', () => {
  const doc = { autoPrint: vi.fn(), output: () => new Blob(['%PDF'], { type: 'application/pdf' }), save: vi.fn() }

  it('comparte el archivo si el dispositivo puede; si cancela, no descarga', async () => {
    vi.stubGlobal('navigator', { canShare: () => true, share: vi.fn().mockRejectedValue(new DOMException('x', 'AbortError')) })
    expect(await sharePdfDocument(doc, 'comprobante_1', 'Pago')).toBe('cancelled')
    expect(doc.save).not.toHaveBeenCalled()
  })

  it('si no comparte archivos, lo descarga', async () => {
    vi.stubGlobal('navigator', { canShare: () => false, share: vi.fn() })
    expect(await sharePdfDocument(doc, 'comprobante_1', 'Pago')).toBe('downloaded')
    expect(doc.save).toHaveBeenCalledWith('comprobante_1.pdf')
  })
})

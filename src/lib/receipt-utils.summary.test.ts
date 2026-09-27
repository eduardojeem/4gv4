import { describe, expect, it } from 'vitest'
import { buildReceiptPaymentSummary, generatePrintHTML, type ReceiptData } from './receipt-utils'

const baseReceipt: ReceiptData = {
  receiptNumber: 'POS-TEST',
  date: '24/09/2026',
  time: '10:00',
  cashier: 'Caja 1',
  items: [{ id: 'p1', name: 'Teléfono', sku: '', price: 1_000_000, quantity: 1 }],
  subtotal: 1_000_000,
  totalDiscount: 0,
  tax: 0,
  total: 1_000_000,
  payments: [],
}

describe('fallback del comprobante POS', () => {
  it('normaliza contado, crédito y mixto sin porcentaje financiado ni vuelto ficticio', () => {
    const creditSale: ReceiptData = {
      ...baseReceipt,
      change: 50_000,
      payments: [{ id: 'credit', method: 'credit', amount: 1_000_000 }],
      creditInfo: {
        baseTotal: 1_000_000, interestAmount: 100_000, financedTotal: 1_100_000,
        installmentCount: 2, installmentAmount: 550_000, frequency: 'monthly',
        interestRate: 10, firstDueDate: '2026-10-24',
      },
    }
    const mixedSale: ReceiptData = {
      ...creditSale,
      payments: [
        { id: 'cash', method: 'cash', amount: 100_000 },
        { id: 'credit', method: 'credit', amount: 400_000 },
      ],
      creditInfo: { ...creditSale.creditInfo!, baseTotal: 400_000, financedTotal: 440_000 },
    }
    const cashSale: ReceiptData = {
      ...baseReceipt,
      payments: [{ id: 'cash', method: 'cash', amount: 1_000_000 }],
      change: 50_000,
    }

    expect(buildReceiptPaymentSummary(creditSale).change).toBeNull()
    expect(buildReceiptPaymentSummary(creditSale)).not.toHaveProperty('financedPercentage')
    expect(buildReceiptPaymentSummary(mixedSale)).toMatchObject({ cashPaid: 100_000, financedPrincipal: 400_000 })
    expect(buildReceiptPaymentSummary(cashSale).change).toBe(50_000)
  })

  it('muestra IVA solamente cuando se solicita un documento fiscal', () => {
    const taxed = { ...baseReceipt, tax: 90_909 }
    expect(generatePrintHTML(taxed)).not.toContain('IVA incluido:')
    expect(generatePrintHTML(taxed, undefined, 'fiscal')).toContain('IVA incluido:')
  })

  it('no promete una garantía fija ni imprime un SKU vacío', () => {
    const html = generatePrintHTML({
      ...baseReceipt,
      payments: [{ id: 'cash', method: 'cash', amount: 1_000_000 }],
      change: 10_000,
    })

    expect(html).not.toContain('GARANTÍA: 30 días')
    expect(html).not.toContain('SKU: </span>')
    expect(html).toContain('PAGADO')
    expect(html).toContain('Cambio:')
    expect(html).not.toContain('IVA')
    expect(html).not.toContain('Precios con IVA incluido')
    expect(html).toContain('class="products compact"')
  })

  it('resume una venta mixta con crédito sin marcarla como totalmente pagada', () => {
    const html = generatePrintHTML({
      ...baseReceipt,
      change: 10_000,
      payments: [
        { id: 'cash', method: 'cash', amount: 300_000 },
        { id: 'credit', method: 'credit', amount: 700_000 },
      ],
      creditInfo: {
        baseTotal: 700_000,
        interestAmount: 70_000,
        financedTotal: 770_000,
        installmentCount: 2,
        installmentAmount: 385_000,
        frequency: 'monthly',
        interestRate: 10,
        firstDueDate: '2026-10-24',
        remainingBalance: 770_000,
      },
    })

    expect(html).toContain('COBRO PARCIAL + CRÉDITO')
    expect(html).toContain('Cobrado hoy')
    expect(html).toContain('Saldo financiado')
    expect(html).toContain('Costo financiero:')
    expect(html).not.toContain('Costo financiero (10%)')
    expect(html).not.toContain('Cambio:')
    expect(html).toContain('class="total-row final financed"')
    expect(html).toMatch(/\.total-row\.final[\s\S]*?font-size: 12px/)
    expect(html).not.toContain('IVA')
    expect(html).toContain('24/10/2026')
    expect(html).not.toContain('✅ PAGADO')
  })
})

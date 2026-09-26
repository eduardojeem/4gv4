import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ReceiptGenerator } from '../ReceiptGenerator'

vi.mock('@/hooks/use-shared-settings', () => ({
  useSharedSettings: () => ({ settings: {} }),
}))

vi.mock('@/hooks/useWebsiteSettings', () => ({
  useAdminWebsiteSettings: () => ({ settings: null }),
}))

describe('ReceiptGenerator credit details', () => {
  const actions = {
    onPrint: () => undefined,
    onDownload: () => undefined,
    onShare: () => undefined,
    formatCurrency: (amount: number) => `Gs. ${amount}`,
  }

  it('muestra un comprobante contado breve y no promete una garantía genérica', () => {
    const html = renderToStaticMarkup(
      <ReceiptGenerator
        receiptData={{
          receiptNumber: 'V-CONTADO',
          date: '24/09/2026',
          time: '10:00',
          cashier: 'Caja 1',
          items: [{ id: 'p1', name: 'Cable USB', sku: '', price: 50000, quantity: 1 }],
          subtotal: 50000,
          totalDiscount: 0,
          tax: 0,
          total: 50000,
          payments: [{ id: 'cash', method: 'cash', amount: 50000 }],
          change: 10000,
        }}
        {...actions}
      />,
    )

    expect(html).toContain('PAGADO')
    expect(html).toContain('Efectivo')
    expect(html).toContain('Cambio:')
    expect(html).not.toContain('IVA')
    expect(html).not.toContain('Precios con IVA incluido')
    expect(html).toContain('data-receipt-products="compact"')
    expect(html).not.toContain('GARANTÍA: 30 días')
    expect(html).not.toContain('SKU:')
  })

  it('muestra IVA solo para un comprobante fiscal explícito', () => {
    const receiptData = {
      receiptNumber: 'V-FISCAL', date: '24/09/2026', time: '10:00', cashier: 'Caja 1',
      items: [{ id: 'p1', name: 'Cable USB', sku: '', price: 100000, quantity: 1 }],
      subtotal: 100000, totalDiscount: 0, tax: 9091, total: 100000,
      payments: [{ id: 'cash', method: 'cash' as const, amount: 100000 }],
    }
    const internalHtml = renderToStaticMarkup(<ReceiptGenerator receiptData={receiptData} {...actions} />)
    const fiscalHtml = renderToStaticMarkup(<ReceiptGenerator receiptData={receiptData} documentKind="fiscal" {...actions} />)

    expect(internalHtml).not.toContain('IVA incluido:')
    expect(internalHtml).toContain('DOCUMENTO NO FISCAL')
    expect(fiscalHtml).toContain('IVA incluido:')
    expect(fiscalHtml).not.toContain('DOCUMENTO NO FISCAL')
  })

  it('en una venta mixta con crédito separa cobrado hoy, costo financiero y saldo', () => {
    const html = renderToStaticMarkup(
      <ReceiptGenerator
        receiptData={{
          receiptNumber: 'V-MIXTA',
          date: '24/09/2026',
          time: '10:00',
          cashier: 'Caja 1',
          items: [{ id: 'p1', name: 'Teléfono', sku: 'TEL-1', price: 1000000, quantity: 1 }],
          subtotal: 1000000,
          totalDiscount: 0,
          tax: 0,
          total: 1000000,
          change: 10000,
          payments: [
            { id: 'cash', method: 'cash', amount: 300000 },
            { id: 'credit', method: 'credit', amount: 700000 },
          ],
          creditInfo: {
            baseTotal: 700000,
            interestAmount: 70000,
            financedTotal: 770000,
            installmentCount: 2,
            installmentAmount: 385000,
            frequency: 'monthly',
            interestRate: 10,
            firstDueDate: '2026-10-24',
            remainingBalance: 770000,
          },
        }}
        {...actions}
      />,
    )

    expect(html).toContain('COBRO PARCIAL + CRÉDITO')
    expect(html).toContain('Cobrado hoy:')
    expect(html).toContain('Gs. 300000')
    expect(html).toContain('Costo financiero:')
    expect(html).not.toContain('Costo financiero (10%)')
    expect(html).not.toContain('Cambio:')
    expect(html).not.toContain('Vuelto:')
    expect(html).toContain('Saldo financiado:')
    expect(html).toContain('Gs. 770000')
  })

  it('distingue la primera cuota pagada del saldo financiado', () => {
    const html = renderToStaticMarkup(<ReceiptGenerator receiptData={{ receiptNumber: 'V-002', date: '02/09/2026', time: '10:00', cashier: 'Caja', items: [], subtotal: 100000, totalDiscount: 0, tax: 0, total: 100000, payments: [{ id: 'credit', method: 'credit', amount: 100000 }], creditInfo: { baseTotal: 100000, interestAmount: 0, financedTotal: 100000, installmentCount: 2, installmentAmount: 50000, frequency: 'monthly', interestRate: 0, firstDueDate: '2026-09-02', remainingBalance: 50000, firstPayment: { amount: 50000, method: 'transfer', bank: 'Banco Test', reference: 'REF123', paymentId: 'payment-1' } } }} onPrint={() => undefined} onDownload={() => undefined} onShare={() => undefined} formatCurrency={amount => `Gs. ${amount}`} />)
    expect(html).toContain('Primera cuota PAGADA: Gs. 50000')
    expect(html).toContain('Banco Test')
    expect(html).toContain('REF123')
    expect(html).toContain('Saldo del crédito al emitir: Gs. 50000')
    expect(html).not.toContain('Cuotas pendientes de cobro. El vencimiento no acredita su pago.')
  })
  it('prints the first installment due date on a credit receipt', () => {
    const html = renderToStaticMarkup(
      <ReceiptGenerator
        receiptData={{
          receiptNumber: 'V-001',
          date: '15/06/2026',
          time: '10:00:00',
          cashier: 'Caja',
          items: [],
          subtotal: 100000,
          totalDiscount: 0,
          tax: 0,
          total: 110000,
          loyaltyPoints: 0,
          payments: [{ id: 'credit', method: 'credit', amount: 110000 }],
          creditInfo: {
            baseTotal: 100000,
            interestAmount: 10000,
            financedTotal: 110000,
            installmentCount: 2,
            installmentAmount: 55000,
            frequency: 'mensuales',
            interestRate: 10,
            firstDueDate: '2026-07-15',
          },
        }}
        onPrint={() => undefined}
        onDownload={() => undefined}
        onShare={() => undefined}
        formatCurrency={(amount) => `Gs. ${amount}`}
      />,
    )

    expect(html).toContain('Primera cuota:')
    expect(html).toContain('15/07/2026')
    expect(html).toContain('TOTAL CON FINANCIACIÓN:')
    expect(html).toContain('data-receipt-total="financed"')
    expect(html).toContain('min-w-0')
    expect(html).toContain('text-base')
    expect(html).not.toContain('IVA')
    expect(html).not.toContain('Gs. 120000')
    expect(html).not.toContain('</div>0<')
  })
})

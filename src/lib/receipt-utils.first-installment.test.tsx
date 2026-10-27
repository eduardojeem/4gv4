import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { buildReceiptPaymentSummary, buildReceiptShareText, firstPaymentChange, generatePrintHTML, type ReceiptData } from './receipt-utils'

vi.mock('@/hooks/use-shared-settings', () => ({ useSharedSettings: () => ({ settings: {} }) }))
vi.mock('@/hooks/useWebsiteSettings', () => ({ useAdminWebsiteSettings: () => ({ settings: null }) }))

const { ReceiptGenerator } = await import('@/components/pos/ReceiptGenerator')

// Crédito de Gs. 100.000 en 2 cuotas, primera cuota cobrada en efectivo con 60.000.
const creditWithFirstPayment: ReceiptData = {
  receiptNumber: 'POS-1',
  date: '26/10/2026',
  time: '10:00',
  cashier: 'Caja',
  items: [{ id: 'p1', name: 'Heladera', sku: '', price: 100000, quantity: 1 }],
  subtotal: 100000,
  totalDiscount: 0,
  tax: 0,
  total: 100000,
  payments: [{ id: 'credit', method: 'credit', amount: 100000 }],
  creditInfo: {
    baseTotal: 100000, interestAmount: 0, financedTotal: 100000,
    installmentCount: 2, installmentAmount: 50000, frequency: 'monthly', interestRate: 0,
    firstDueDate: '2026-10-26', remainingBalance: 50000,
    firstPayment: { amount: 50000, method: 'cash', cashReceived: 60000, change: 10000, paymentId: 'pay-1' },
  },
}

describe('primera cuota cobrada al emitir el crédito', () => {
  it('el total con financiación no suma la cuota cobrada dos veces', () => {
    // Antes: 50.000 cobrados + 100.000 financiados = 150.000 en un crédito de 100.000.
    expect(buildReceiptPaymentSummary(creditWithFirstPayment)).toMatchObject({
      collectedToday: 50000,
      financedBalance: 50000,
      totalWithFinancing: 100000,
    })
  })

  it('en una venta mixta suma la entrega inicial y el financiado', () => {
    const mixed: ReceiptData = {
      ...creditWithFirstPayment,
      payments: [{ id: 'cash', method: 'cash', amount: 40000 }, { id: 'credit', method: 'credit', amount: 60000 }],
      creditInfo: { ...creditWithFirstPayment.creditInfo!, baseTotal: 60000, interestAmount: 6000, financedTotal: 66000, installmentAmount: 33000, remainingBalance: 33000, firstPayment: { amount: 33000, method: 'cash', cashReceived: 33000, paymentId: 'p' } },
    }
    expect(buildReceiptPaymentSummary(mixed)).toMatchObject({ collectedToday: 73000, totalWithFinancing: 106000 })
  })

  it('el saldo a favor paga la venta pero no figura como cobrado hoy', () => {
    const withStoreCredit: ReceiptData = {
      ...creditWithFirstPayment,
      payments: [{ id: 'sc', method: 'store_credit', amount: 20000 }, { id: 'credit', method: 'credit', amount: 80000 }],
      creditInfo: { ...creditWithFirstPayment.creditInfo!, baseTotal: 80000, financedTotal: 80000, installmentAmount: 40000, remainingBalance: 80000, firstPayment: undefined },
    }
    expect(buildReceiptPaymentSummary(withStoreCredit)).toMatchObject({
      collectedToday: 0,
      storeCreditApplied: 20000,
      totalWithFinancing: 100000,
      paymentState: 'CRÉDITO REGISTRADO',
    })
  })

  it('el ticket en pantalla (el que se imprime) muestra total correcto y vuelto de la cuota', () => {
    const html = renderToStaticMarkup(<ReceiptGenerator receiptData={creditWithFirstPayment} formatCurrency={amount => `Gs. ${amount}`} />)
    expect(html).toContain('Primera cuota PAGADA: Gs. 50000')
    expect(html).toContain('Recibido: Gs. 60000')
    expect(html).toContain('Vuelto de la cuota: Gs. 10000')
    expect(html).toContain('>Gs. 100000</span></div>')
    expect(html).not.toContain('Gs. 150000')
  })

  it('el ticket generado en HTML también detalla la cuota cobrada', () => {
    const html = generatePrintHTML(creditWithFirstPayment)
    expect(html).toContain('Primera cuota PAGADA:')
    expect(html).toContain('Vuelto de la cuota:')
    expect(html).not.toContain('150.000')
  })

  it('el texto para compartir usa el mismo total', () => {
    const text = buildReceiptShareText(creditWithFirstPayment, 'Tienda')
    expect(text).toMatch(/Total con financiación: Gs\.\s100\.000/)
    expect(text).not.toContain('150.000')
  })

  it('recorrido completo: venta a crédito con la cuota 1 cobrada descuenta, no suma', async () => {
    const { buildPosCreditSummary, withPersistedCreditSchedule } = await import('@/lib/credits/pos-credit-summary')
    // Venta de Gs. 300.000 a 3 cuotas con 10%: financiado 330.000, cuotas de 110.000.
    const summary = buildPosCreditSummary(300000, {
      count: 3, frequency: 'monthly', interestRate: 10, firstInstallmentTiming: 'at_start',
      startDate: '2026-10-26', firstPayment: { method: 'cash', cashReceived: 120000 },
    })
    expect(summary).toMatchObject({ financedTotal: 330000, installmentAmount: 110000, firstPaymentAmount: 110000, remainingBalance: 220000 })
    // Lo que devuelve el servidor (pos_credit_checkout_summary) después de cobrar la cuota 1.
    const persisted = withPersistedCreditSchedule({ ...summary, interestRate: 10 }, {
      firstPayment: { amount: 110000, method: 'cash', cashReceived: 120000, change: 10000, paymentId: 'p1' },
      firstPaymentAmount: 110000,
      remainingBalance: 220000,
      installments: summary.installments,
    })
    const receipt: ReceiptData = {
      ...creditWithFirstPayment,
      subtotal: 300000, total: 300000,
      payments: [{ id: 'credit', method: 'credit', amount: 330000 }],
      creditInfo: persisted,
    }
    expect(buildReceiptPaymentSummary(receipt)).toMatchObject({
      collectedToday: 110000,
      financedBalance: 220000,
      // 330.000 en total: la cuota cobrada ya está adentro, no se agrega otra vez.
      totalWithFinancing: 330000,
    })
    expect(firstPaymentChange(persisted.firstPayment!)).toBe(10000)
  })

  it('calcula el vuelto aunque la venta vieja no lo haya guardado', () => {
    expect(firstPaymentChange({ amount: 50000, method: 'cash', cashReceived: 55000, paymentId: 'x' })).toBe(5000)
    expect(firstPaymentChange({ amount: 50000, method: 'transfer', paymentId: 'x' })).toBe(0)
  })
})

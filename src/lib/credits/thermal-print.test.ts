import { describe, expect, it } from 'vitest'
import { createCreditPaymentReceiptPdf } from './payment-receipt'
import { createGlobalPaymentReceiptPdf } from './global-payment-receipt'
import { createCreditHistoryTicket } from './credit-history-ticket'
import { getThermalPrintHtml } from './thermal-print'

describe('thermal receipts adapt to the browser printable area', () => {
  it.each(['58mm', '80mm'] as const)('restores paid and pending installment boxes on %s receipts', async format => {
    const { doc } = await createCreditPaymentReceiptPdf({
      paymentId: 'pay', creditId: 'credit', customerName: 'Cliente de prueba',
      paymentAmount: 100000, totalInstallments: 12, paidInstallmentsCount: 3,
      pendingInstallmentsCount: 9,
    }, { format })
    const page = new DOMParser().parseFromString(getThermalPrintHtml(doc)!, 'text/html')
    const bar = page.querySelector('[role="progressbar"]')
    expect(bar).not.toBeNull()
    expect(bar!.getAttribute('aria-valuenow')).toBe('3')
    expect(bar!.getAttribute('aria-valuemax')).toBe('12')
    expect(bar!.querySelectorAll('rect[fill="#000"]')).toHaveLength(3)
    expect(bar!.querySelectorAll('rect[fill="none"]')).toHaveLength(9)
    expect(bar!.textContent).toContain('3 de 12 pagadas · Faltan 9')
    expect(bar!.closest('section')?.textContent).toContain('PLAN DE CUOTAS')
  })

  it.each(['58mm', '80mm'] as const)('wraps long plans into readable rows on %s', async format => {
    const { doc } = await createCreditPaymentReceiptPdf({
      paymentId: 'long', creditId: 'credit', customerName: 'Cliente de prueba',
      paymentAmount: 100000, totalInstallments: 60, paidInstallmentsCount: 17,
    }, { format })
    const page = new DOMParser().parseFromString(getThermalPrintHtml(doc)!, 'text/html')
    const bar = page.querySelector('[role="progressbar"]')!
    const boxes = [...bar.querySelectorAll('rect')]
    expect(boxes).toHaveLength(60)
    expect(new Set(boxes.map(box => box.getAttribute('y'))).size).toBeGreaterThan(1)
    expect(bar.textContent).toContain('17 de 60 pagadas · Faltan 43')
  })

  it.each([0, 12, 13])('prints bounded progress when the recorded paid count is %s', async paid => {
    const { doc } = await createCreditPaymentReceiptPdf({
      paymentId: 'pay', creditId: 'credit', customerName: 'Cliente de prueba',
      paymentAmount: 100000, totalInstallments: 12, paidInstallmentsCount: paid,
    }, { format: '80mm' })
    const page = new DOMParser().parseFromString(getThermalPrintHtml(doc)!, 'text/html')
    const bar = page.querySelector('[role="progressbar"]')!
    expect(bar).not.toBeNull()
    expect(bar.querySelectorAll('rect')).toHaveLength(12)
    expect(bar.querySelectorAll('rect[fill="#000"]')).toHaveLength(paid === 0 ? 0 : 12)
  })

  it('does not invent installment progress when a historical receipt has no counts', async () => {
    const { doc } = await createCreditPaymentReceiptPdf({
      paymentId: 'historical', creditId: 'credit', customerName: 'Cliente de prueba', paymentAmount: 100000,
    }, { format: '58mm' })
    const page = new DOMParser().parseFromString(getThermalPrintHtml(doc)!, 'text/html')
    expect(page.querySelector('[role="progressbar"]')).toBeNull()
  })

  it('registers the same payment data without a fixed-width PDF print viewport', async () => {
    const { doc } = await createCreditPaymentReceiptPdf({
      paymentId: 'pay', creditId: 'credit', customerName: '<img src=x onerror=alert(1)>',
      paymentAmount: 125000, totalCreditAmount: 500000, totalPaidAmount: 125000,
      currentCreditBalance: 375000, notes: 'Observación de prueba '.repeat(50) + ' FINAL_NOTAS',
      businessName: 'COMERCIAL DE PRUEBA', businessAddress: 'Dirección extensa de prueba '.repeat(5),
      reference: 'REFERENCIASINESPACIOS'.repeat(12), productSummary: 'Producto y accesorios con descripción extensa '.repeat(12),
    }, { format: '80mm' })
    const html = getThermalPrintHtml(doc)
    expect(html).toContain('125.000')
    expect(html).toContain('375.000')
    expect(html).toContain('&lt;img')
    expect(html).not.toContain('<img')
    expect(html).toContain('overflow-wrap:anywhere')
    expect(html).toContain('max-width:70mm')
    expect(html).not.toMatch(/size:\s*80mm|(?:html|body|main)[^{]*\{[^}]*height:\s*\d+mm/)
    expect(html).toContain('width:100%')
    if (process.env.CREDIT_PRINT_ARTIFACT_DIR) {
      const fs = await import('node:fs/promises')
      const path = await import('node:path')
      await fs.mkdir(process.env.CREDIT_PRINT_ARTIFACT_DIR, { recursive: true })
      await fs.writeFile(path.join(process.env.CREDIT_PRINT_ARTIFACT_DIR, 'ticket-80mm.html'), html!)
      await fs.writeFile(path.join(process.env.CREDIT_PRINT_ARTIFACT_DIR, 'ticket-original.pdf'), Buffer.from(doc.output('arraybuffer')))
    }
  })

  it('covers global payments and statements while keeping A4 on its PDF path', async () => {
    const input = { receiptNumber: 'ABN-TEST', paidAt: '2026-10-17', totalAmount: 125000,
      paymentMethod: 'cash', customerName: 'Cliente prueba', allocations: [], excessToStoreCredit: 0 }
    const thermal = await createGlobalPaymentReceiptPdf(input, { format: '58mm' })
    const sheet = await createGlobalPaymentReceiptPdf(input, { format: 'A4' })
    expect(getThermalPrintHtml(thermal.doc)).toContain('ABN-TEST')
    expect(getThermalPrintHtml(thermal.doc)).toContain('max-width:46mm')
    expect(getThermalPrintHtml(sheet.doc)).toBeUndefined()
    const statement = await createCreditHistoryTicket({ customerName: 'Cliente prueba',
      companyName: 'Comercial', credits: [], totalDebt: 375000, totalPaid: 125000 }, { format: '80mm' })
    expect(getThermalPrintHtml(statement)).toContain('375.000')
    expect(getThermalPrintHtml(statement)).toContain('ESTADO DE CUENTA')
  })
})

import { afterEach, expect, it, vi } from 'vitest'
import { generatePrintHTML, printReceipt, type ReceiptData } from '@/lib/receipt-utils'

const receipt: ReceiptData = {
  isReprint: true, receiptNumber: 'VTA-ORIGINAL', date: '17/11/2026', time: '12:00',
  cashier: 'Ana', items: [], subtotal: 100, totalDiscount: 0, tax: 0, total: 100,
  payments: [{ id: 'p', method: 'cash', amount: 100 }],
}
afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); vi.useRealTimers() })
it('identifica la copia sin cambiar el número original', () => {
  const html = generatePrintHTML(receipt, { name: 'Comercio' })
  expect(html).toContain('COPIA · REIMPRESIÓN')
  expect(html).toContain('VTA-ORIGINAL')
  expect(generatePrintHTML({ ...receipt, isReprint: false }, { name: 'Comercio' })).not.toContain('COPIA · REIMPRESIÓN')
})
it('reimprime la venta elegida aunque exista otro ticket en el DOM', () => {
  vi.useFakeTimers()
  document.body.innerHTML = '<div id="receipt-content">OTRA-VENTA</div>'
  const write = vi.fn()
  vi.spyOn(window, 'open').mockReturnValue({ document: { write, close: vi.fn(), readyState: 'complete', images: [] }, addEventListener: vi.fn(), focus: vi.fn(), print: vi.fn() } as unknown as Window)
  printReceipt(receipt, { name: 'Comercio' })
  expect(write.mock.calls[0][0]).toContain('VTA-ORIGINAL')
  expect(write.mock.calls[0][0]).toContain('COPIA · REIMPRESIÓN')
  expect(write.mock.calls[0][0]).not.toContain('OTRA-VENTA')
})

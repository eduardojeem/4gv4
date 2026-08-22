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
  })
})

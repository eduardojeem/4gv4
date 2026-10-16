// @vitest-environment node
import { expect, it } from 'vitest'
import { receiptSnapshotSchema, createSnapshotReceiptPdf } from './receipt-snapshot'
import { buildAccountStatusRows } from './payment-receipt'
import { historicalCollectionReceipt } from './historical-receipt'
import { buildGlobalPaymentAccountRows } from './global-payment-receipt'

it('preserves explicit paid amounts, receipt identity, and currency on every print', async () => {
  const snapshot = receiptSnapshotSchema.parse({ kind: 'credit', input: {
    customerName: 'Cliente prueba', creditId: 'credit', paymentId: 'payment', receiptNumber: 'COL-ORIGINAL',
    paymentDate: '2026-10-15T12:00:00Z', paymentAmount: 10.25, paymentMethod: 'cash',
    totalCreditAmount: 100, totalPaidAmount: 10.25, currentCreditBalance: 89.75, currency: 'USD', locale: 'en-US', timeZone: 'America/Asuncion',
  } })
  if (snapshot.kind !== 'credit') throw new Error('Wrong fixture')
  expect(buildAccountStatusRows(snapshot.input)).toContainEqual(['Total pagado', '$10.25'])
  for (const format of ['58mm', '80mm', 'A4'] as const) {
    const result = await createSnapshotReceiptPdf(snapshot, format)
    expect(result.receiptNumber).toBe('COL-ORIGINAL')
    expect(result.doc.output()).toContain('COL-ORIGINAL')
  }
})
it('never reports current account totals as historical when no snapshot was saved', () => {
  const input = historicalCollectionReceipt({ receiptId: 'r', receiptNumber: 'COL-OLD', recordedAt: '2026-10-15T12:00:00Z',
    appliedAmount: 100, excessToStoreCredit: 0, allocations: [{ debtId: 'i', paymentId: 'p', type: 'installment', appliedAmount: 100, remainingBalance: 20 }] }, 'Prueba')
  expect(input.receiptNumber).toBe('COL-OLD')
  expect(buildGlobalPaymentAccountRows(input)).toEqual([])
  expect(input.historicalNote).toContain('histórico')
})

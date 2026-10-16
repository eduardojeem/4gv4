import { z } from 'zod'

const optionalText = z.string().nullable().optional()
const optionalMoney = z.number().finite().nonnegative().nullable().optional()
const party = {
  customerName: z.string(), businessName: optionalText, businessRuc: optionalText,
  businessPhone: optionalText, businessAddress: optionalText,
  currency: z.string().optional(), locale: z.string().optional(), timeZone: z.string().optional(),
}
export const receiptSnapshotSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('credit'), input: z.object({
    ...party, paymentId: z.string(), receiptNumber: z.string(), paymentDate: z.string(),
    paymentAmount: z.number().finite().positive(), paymentMethod: z.string(), reference: optionalText, notes: optionalText,
    creditId: z.string(), creditCode: optionalText, creditLabel: optionalText,
    saleCode: optionalText, productSummary: optionalText, originLabel: optionalText,
    customerId: optionalText, customerRuc: optionalText, customerCode: optionalText,
    totalCreditAmount: optionalMoney, totalPaidAmount: optionalMoney, currentCreditBalance: optionalMoney,
    totalInstallments: optionalMoney, paidInstallmentsCount: optionalMoney, pendingInstallmentsCount: optionalMoney,
    installmentNumber: optionalMoney, installmentDueDate: optionalText, installmentAmount: optionalMoney,
    nextDueDate: optionalText, nextDueAmount: optionalMoney,
  }) }),
  z.object({ kind: z.literal('global'), input: z.object({
    ...party, receiptNumber: z.string(), paidAt: z.string(), totalAmount: z.number().finite().positive(),
    paymentMethod: z.string(), customerDocument: optionalText,
    referenceNumber: optionalText, voucherNumber: optionalText, notes: optionalText,
    bankName: optionalText, cardType: z.enum(['credit', 'debit']).nullable().optional(), posNetwork: optionalText, lastFourDigits: optionalText,
    excessToStoreCredit: z.number().nonnegative(), otherPendingAmount: optionalMoney,
    coveredDebtsOnly: z.boolean().optional(),
    allocations: z.array(z.object({ id: z.string(), type: z.enum(['repair', 'installment']), title: z.string(),
      allocatedAmount: z.number().nonnegative(), totalAmount: z.number().nonnegative(), newPending: z.number().nonnegative() })),
  }) }),
])
export type ReceiptSnapshot = z.infer<typeof receiptSnapshotSchema>

export async function createSnapshotReceiptPdf(snapshot: ReceiptSnapshot, format: import('./paper').CreditPaperFormat) {
  if (snapshot.kind === 'credit') {
    const { createCreditPaymentReceiptPdf } = await import('./payment-receipt')
    return createCreditPaymentReceiptPdf(snapshot.input, { format })
  }
  const { createGlobalPaymentReceiptPdf } = await import('./global-payment-receipt')
  return createGlobalPaymentReceiptPdf(snapshot.input, { format })
}

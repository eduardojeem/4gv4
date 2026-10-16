import type { CollectionResult } from './collection-contract'
import type { GlobalPaymentReceiptInput } from './global-payment-receipt'

export function historicalCollectionReceipt(collection: CollectionResult, customerName: string): GlobalPaymentReceiptInput {
  return {
    receiptNumber: collection.receiptNumber, paidAt: collection.recordedAt,
    totalAmount: collection.appliedAmount + collection.excessToStoreCredit,
    paymentMethod: collection.paymentMethod || 'No especificado', customerName,
    referenceNumber: collection.paymentMethod === 'transfer' ? collection.reference : undefined,
    voucherNumber: collection.paymentMethod === 'card' ? collection.reference : undefined,
    notes: collection.notes, excessToStoreCredit: collection.excessToStoreCredit,
    accountSnapshotAvailable: false,
    historicalNote: 'Cobro histórico. Se conserva el número y reparto registrados; no se guardó el estado completo de la cuenta a esa fecha. Datos de identificación actuales.',
    allocations: collection.allocations.map(row => ({ id: row.debtId, type: row.type,
      title: `${row.type === 'installment' ? 'Cuota' : 'Reparación'} ${row.debtId.slice(0, 8)}`,
      allocatedAmount: row.appliedAmount, totalAmount: row.totalAmount ?? row.appliedAmount + row.remainingBalance,
      newPending: row.remainingBalance })),
  }
}

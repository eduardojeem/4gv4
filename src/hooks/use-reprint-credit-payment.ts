'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import { useCreditPrinting } from '@/hooks/use-credit-printing'
import { collectionResultSchema } from '@/lib/credits/collection-contract'
import { createGlobalPaymentReceiptPdf } from '@/lib/credits/global-payment-receipt'
import { historicalCollectionReceipt } from '@/lib/credits/historical-receipt'
import { createCreditPaymentReceiptPdf } from '@/lib/credits/payment-receipt'
import { printPdfDocument } from '@/lib/credits/print-receipt'
import { createSnapshotReceiptPdf } from '@/lib/credits/receipt-snapshot'

export type ReprintablePayment = {
  id: string
  credit_id: string
  amount: number
  payment_method?: string | null
  created_at?: string | null
  notes?: string | null
}

/**
 * Reimprime el comprobante de un pago de crédito con lo que se guardó al
 * cobrarlo. Lo comparten el historial de Créditos y la ficha del cliente: antes
 * la lógica vivía solo en el historial y desde la ficha no se podía reimprimir.
 */
export function useReprintCreditPayment() {
  const { format, issuer } = useCreditPrinting()

  return useCallback(async (payment: ReprintablePayment, customerName: string) => {
    try {
      const response = await fetch('/api/credits/receipts?paymentId=' + encodeURIComponent(payment.id), { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok || !body.success) throw new Error(body.error || 'No se pudo recuperar el comprobante guardado.')

      let result
      if (body.collection) {
        const collection = collectionResultSchema.parse(body.collection)
        result = collection.receipt
          ? await createSnapshotReceiptPdf(collection.receipt, format)
          : await createGlobalPaymentReceiptPdf({ ...historicalCollectionReceipt(collection, customerName), ...issuer }, { format })
      } else {
        result = await createCreditPaymentReceiptPdf({
          paymentId: payment.id,
          receiptNumber: 'HIST-' + payment.id.slice(0, 10).toUpperCase(),
          paymentDate: payment.created_at ?? null,
          paymentAmount: Number(payment.amount),
          paymentMethod: payment.payment_method,
          notes: payment.notes,
          customerName,
          creditId: payment.credit_id,
          historicalNote: 'Constancia de pago histórico. No se conserva el comprobante original ni el saldo a esa fecha. Datos de identificación actuales.',
          ...issuer,
        }, { format })
      }

      await printPdfDocument(result.doc)
    } catch (error) {
      // El pago YA quedó registrado: el mensaje lo deja claro para que nadie
      // vuelva a cobrarlo creyendo que falló el cobro.
      toast.error('No se pudo imprimir el comprobante', {
        description: `El pago quedó registrado. ${error instanceof Error ? error.message : 'Volvé a intentar desde el historial.'}`,
      })
    }
  }, [format, issuer])
}

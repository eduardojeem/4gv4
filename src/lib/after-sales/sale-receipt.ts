import type { CartItem, PaymentSplit, ReceiptData } from '@/lib/receipt-utils'

/**
 * Arma el ticket de una venta ya emitida, para reimprimirla desde Posventa.
 *
 * No usa `createReceiptData()` a proposito: esa funcion emite un numero nuevo
 * con `generateReceiptNumber()` y toma las formas en memoria del POS. Reimprimir
 * con numero nuevo y fecha de hoy dejaria dos documentos distintos para la misma
 * venta, que es peor que no poder reimprimir. Acá el numero y la fecha son
 * siempre los de la venta original.
 */

export type StoredSaleItem = {
  id: string
  product_id?: string | null
  name: string
  sku?: string | null
  quantity: number
  unitPrice: number
  discount?: number | null
}

export type StoredSalePayment = {
  id?: string | null
  method?: string | null
  amount: number
  reference?: string | null
}

export type StoredSale = {
  id: string
  code: string | null
  createdAt: string | null
  subtotal: number
  tax: number
  discount: number
  total: number
  paymentMethod?: string | null
  cashierName?: string | null
  customer?: { name?: string | null; phone?: string | null; email?: string | null } | null
  items: StoredSaleItem[]
  payments?: StoredSalePayment[] | null
}

const PAYMENT_METHODS: PaymentSplit['method'][] = ['cash', 'card', 'transfer', 'credit']

/** El POS guarda el metodo en varias formas; el ticket entiende cuatro. */
export function normalizeReceiptPaymentMethod(value: unknown): PaymentSplit['method'] {
  const raw = String(value ?? '').trim().toLowerCase()
  if (PAYMENT_METHODS.includes(raw as PaymentSplit['method'])) {
    return raw as PaymentSplit['method']
  }
  if (raw === 'efectivo') return 'cash'
  if (raw === 'tarjeta' || raw === 'debit' || raw === 'debito' || raw === 'credit_card') return 'card'
  if (raw === 'transferencia' || raw === 'bank_transfer') return 'transfer'
  if (raw === 'credito' || raw === 'crédito') return 'credit'
  return 'cash'
}

function splitDateTime(createdAt: string | null) {
  if (!createdAt) return { date: '-', time: '-' }
  const parsed = new Date(createdAt)
  if (Number.isNaN(parsed.getTime())) return { date: '-', time: '-' }
  return {
    date: parsed.toLocaleDateString('es-PY'),
    time: parsed.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' }),
  }
}

function toAmount(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export function buildReprintReceiptData(sale: StoredSale): ReceiptData {
  const { date, time } = splitDateTime(sale.createdAt)

  const items: CartItem[] = sale.items.map((item) => ({
    id: item.id,
    name: item.name,
    sku: item.sku ?? '',
    price: toAmount(item.unitPrice),
    quantity: Math.max(1, Math.trunc(Number(item.quantity) || 1)),
    discount: item.discount == null ? undefined : toAmount(item.discount),
  }))

  // Si la venta no guardo el desglose de pagos, se reconstruye uno solo por el
  // total con el metodo declarado: es fiel a lo cobrado aunque pierda el detalle.
  const storedPayments = sale.payments ?? []
  const payments: PaymentSplit[] = storedPayments.length > 0
    ? storedPayments.map((payment, index) => ({
        id: String(payment.id ?? `payment-${index}`),
        method: normalizeReceiptPaymentMethod(payment.method),
        amount: toAmount(payment.amount),
        reference: payment.reference ?? undefined,
      }))
    : [{
        id: 'payment-0',
        method: normalizeReceiptPaymentMethod(sale.paymentMethod),
        amount: toAmount(sale.total),
      }]

  return {
    isReprint: true,
    // El numero es el codigo de la venta original, nunca uno nuevo.
    receiptNumber: sale.code || sale.id.slice(0, 8).toUpperCase(),
    date,
    time,
    cashier: sale.cashierName || 'Sistema POS',
    customer: sale.customer?.name
      ? {
          name: sale.customer.name,
          phone: sale.customer.phone ?? '',
          email: sale.customer.email ?? '',
        }
      : undefined,
    items,
    subtotal: toAmount(sale.subtotal),
    totalDiscount: toAmount(sale.discount),
    tax: toAmount(sale.tax),
    total: toAmount(sale.total),
    payments,
  }
}

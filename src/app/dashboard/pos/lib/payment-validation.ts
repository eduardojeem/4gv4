import type { PaymentSplit } from '../types'

export type MixedPaymentValidationCode =
  | 'PAYMENTS_REQUIRED'
  | 'PAYMENT_LIMIT_EXCEEDED'
  | 'INVALID_PAYMENT_AMOUNT'
  | 'CARD_REFERENCE_REQUIRED'
  | 'TRANSFER_REFERENCE_REQUIRED'
  | 'PAYMENT_INCOMPLETE'
  | 'PAYMENT_EXCESS'

export type MixedPaymentValidation = {
  valid: boolean
  code: MixedPaymentValidationCode | null
  remaining: number
}

const roundMoney = (value: number) => Math.round(value * 100) / 100

export function getMixedPaymentValidation(
  total: number,
  payments: Array<Pick<PaymentSplit, 'method' | 'amount' | 'reference' | 'cardLast4'>>
): MixedPaymentValidation {
  const paid = roundMoney(payments.reduce((sum, payment) => sum + payment.amount, 0))
  const remaining = roundMoney(total - paid)

  if (payments.length === 0) return { valid: false, code: 'PAYMENTS_REQUIRED', remaining }
  if (payments.length > 10) return { valid: false, code: 'PAYMENT_LIMIT_EXCEEDED', remaining }

  for (const payment of payments) {
    if (!Number.isFinite(payment.amount) || payment.amount <= 0) {
      return { valid: false, code: 'INVALID_PAYMENT_AMOUNT', remaining }
    }
    if (payment.method === 'card' && !/^\d{4}$/.test(payment.cardLast4 || '')) {
      return { valid: false, code: 'CARD_REFERENCE_REQUIRED', remaining }
    }
    if (payment.method === 'transfer' && !payment.reference?.trim()) {
      return { valid: false, code: 'TRANSFER_REFERENCE_REQUIRED', remaining }
    }
  }

  if (remaining > 0.01) return { valid: false, code: 'PAYMENT_INCOMPLETE', remaining }
  if (remaining < -0.01) return { valid: false, code: 'PAYMENT_EXCESS', remaining }
  return { valid: true, code: null, remaining: 0 }
}

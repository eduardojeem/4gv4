import type { OrderStatus, PaymentStatus } from './types'

const REFUNDABLE_STATUSES: PaymentStatus[] = ['PAID', 'PARTIAL']
const CONFIRMABLE_STATUSES: PaymentStatus[] = ['PENDING', 'PARTIAL', 'FAILED']

const PAYMENT_STATUS_ALIASES: Record<string, PaymentStatus> = {
  PENDING: 'PENDING',
  PENDIENTE: 'PENDING',
  PAID: 'PAID',
  PAGADO: 'PAID',
  PAGADA: 'PAID',
  COMPLETED: 'PAID',
  COMPLETADO: 'PAID',
  COMPLETADA: 'PAID',
  PARTIAL: 'PARTIAL',
  PARCIAL: 'PARTIAL',
  REFUNDED: 'REFUNDED',
  REEMBOLSADO: 'REFUNDED',
  REEMBOLSADA: 'REFUNDED',
  FAILED: 'FAILED',
  FALLIDO: 'FAILED',
  FALLIDA: 'FAILED',
  CANCELLED: 'FAILED',
  CANCELADO: 'FAILED',
  CANCELADA: 'FAILED',
}

export function normalizePaymentStatus(value: unknown): PaymentStatus {
  const normalized = String(value ?? 'PENDING').trim().toUpperCase()
  return PAYMENT_STATUS_ALIASES[normalized] ?? 'PENDING'
}

export function isPaymentConfirmable(status: PaymentStatus) {
  return CONFIRMABLE_STATUSES.includes(status)
}

export function canTransitionPaymentStatus(
  orderStatus: OrderStatus,
  from: PaymentStatus,
  to: PaymentStatus
) {
  if (from === to) return true

  if (orderStatus === 'CANCELLED' && !['REFUNDED', 'FAILED'].includes(to)) {
    return false
  }

  if (to === 'PENDING') return false
  if (to === 'REFUNDED') return REFUNDABLE_STATUSES.includes(from)
  if (from === 'REFUNDED') return false

  return isPaymentConfirmable(from)
}

export function getInvalidPaymentTransitionMessage(
  orderStatus: OrderStatus,
  from: PaymentStatus,
  to: PaymentStatus
) {
  if (orderStatus === 'CANCELLED' && !['REFUNDED', 'FAILED'].includes(to)) {
    return 'No se puede confirmar un pago para un pedido cancelado.'
  }

  if (to === 'PENDING') {
    return 'No se puede revertir un pago a pendiente desde este flujo.'
  }

  if (to === 'REFUNDED' && !REFUNDABLE_STATUSES.includes(from)) {
    return 'Solo se puede reembolsar un pedido pagado o parcialmente pagado.'
  }

  if (from === 'REFUNDED') {
    return 'Un pago reembolsado no puede volver a cambiarse desde este flujo.'
  }

  return `Transicion de pago invalida de ${from} a ${to}.`
}

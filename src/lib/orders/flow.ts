import type { OrderStatus } from './types'

export const ORDER_FLOW: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SHIPPED', 'DELIVERED']
export const TERMINAL_ORDER_STATUSES: OrderStatus[] = ['DELIVERED', 'CANCELLED']

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PENDING: 'CONFIRMED',
  CONFIRMED: 'PREPARING',
  PREPARING: 'READY',
  READY: 'SHIPPED',
  SHIPPED: 'DELIVERED',
}

const ORDER_STATUS_ALIASES: Record<string, OrderStatus> = {
  PENDING: 'PENDING',
  PENDIENTE: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CONFIRMADO: 'CONFIRMED',
  CONFIRMADA: 'CONFIRMED',
  PREPARING: 'PREPARING',
  PREPARANDO: 'PREPARING',
  READY: 'READY',
  LISTO: 'READY',
  LISTA: 'READY',
  SHIPPED: 'SHIPPED',
  ENVIADO: 'SHIPPED',
  ENVIADA: 'SHIPPED',
  DESPACHADO: 'SHIPPED',
  DESPACHADA: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  ENTREGADO: 'DELIVERED',
  ENTREGADA: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  CANCELED: 'CANCELLED',
  CANCELADO: 'CANCELLED',
  CANCELADA: 'CANCELLED',
}

const ORDER_STATUS_DB_VALUES: Record<OrderStatus, string[]> = {
  PENDING: ['PENDING', 'pending', 'pendiente', 'PENDIENTE'],
  CONFIRMED: ['CONFIRMED', 'confirmed', 'confirmado', 'confirmada', 'CONFIRMADO', 'CONFIRMADA'],
  PREPARING: ['PREPARING', 'preparing', 'preparando', 'PREPARANDO'],
  READY: ['READY', 'ready', 'listo', 'lista', 'LISTO', 'LISTA'],
  SHIPPED: ['SHIPPED', 'shipped', 'enviado', 'enviada', 'despachado', 'despachada', 'ENVIADO', 'ENVIADA', 'DESPACHADO', 'DESPACHADA'],
  DELIVERED: ['DELIVERED', 'delivered', 'entregado', 'entregada', 'ENTREGADO', 'ENTREGADA'],
  CANCELLED: ['CANCELLED', 'cancelled', 'CANCELED', 'canceled', 'cancelado', 'cancelada', 'CANCELADO', 'CANCELADA'],
}

export function normalizeOrderStatus(value: unknown): OrderStatus {
  const normalized = String(value ?? 'PENDING').trim().toUpperCase()
  return ORDER_STATUS_ALIASES[normalized] ?? 'PENDING'
}

export function getOrderStatusDbValues(status: OrderStatus) {
  return ORDER_STATUS_DB_VALUES[status]
}

export function isTerminalOrderStatus(status: OrderStatus) {
  return TERMINAL_ORDER_STATUSES.includes(status)
}

export function getNextOrderStatus(status: OrderStatus) {
  return NEXT_STATUS[status] ?? null
}

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus) {
  if (from === to) return true
  if (isTerminalOrderStatus(from)) return false
  if (to === 'CANCELLED') return true
  return NEXT_STATUS[from] === to
}

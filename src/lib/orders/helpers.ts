import type { CustomerOrder, CustomerOrderItem, OrderStatus } from './types'
import { ORDER_FLOW, normalizeOrderStatus } from './flow'
import { normalizePaymentStatus } from './payment-flow'

type RawOrderItem = Record<string, unknown>
type RawOrder = Record<string, unknown> & {
  order_items?: RawOrderItem[]
  customer_order_items?: RawOrderItem[]
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export function generateOrderNumber() {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const entropy = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '').slice(-8).toUpperCase()
    : Math.random().toString(36).slice(2, 10).toUpperCase()
  return `PED-${date}-${entropy}`
}

export function normalizeOrderItem(item: RawOrderItem): CustomerOrderItem {
  return {
    id: String(item.id ?? ''),
    product_id: item.product_id ? String(item.product_id) : null,
    product_name: String(item.product_name ?? 'Producto'),
    product_sku: item.product_sku ? String(item.product_sku) : null,
    quantity: toNumber(item.quantity),
    unit_price: toNumber(item.unit_price),
    subtotal: toNumber(item.subtotal),
  }
}

export function normalizeOrder(order: RawOrder): CustomerOrder {
  const items = order.order_items ?? order.customer_order_items ?? []

  return {
    id: String(order.id ?? ''),
    organization_id: String(order.organization_id ?? ''),
    customer_id: order.customer_id ? String(order.customer_id) : null,
    order_number: String(order.order_number ?? ''),
    status: normalizeOrderStatus(order.status),
    payment_status: normalizePaymentStatus(order.payment_status),
    payment_method: String(order.payment_method ?? 'CASH').toUpperCase() as CustomerOrder['payment_method'],
    fulfillment_type: String(order.fulfillment_type ?? 'PICKUP').toUpperCase() as CustomerOrder['fulfillment_type'],
    customer_name: String(order.customer_name ?? ''),
    customer_email: order.customer_email ? String(order.customer_email) : null,
    customer_phone: order.customer_phone ? String(order.customer_phone) : null,
    customer_address: order.customer_address ? String(order.customer_address) : null,
    subtotal: toNumber(order.subtotal),
    tax_amount: toNumber(order.tax_amount),
    shipping_cost: toNumber(order.shipping_cost),
    discount_amount: toNumber(order.discount_amount),
    total: toNumber(order.total),
    notes: order.notes ? String(order.notes) : null,
    created_at: String(order.created_at ?? ''),
    updated_at: String(order.updated_at ?? ''),
    estimated_delivery_date: order.estimated_delivery_date ? String(order.estimated_delivery_date) : null,
    delivered_at: order.delivered_at ? String(order.delivered_at) : null,
    cancelled_at: order.cancelled_at ? String(order.cancelled_at) : null,
    stock_reserved: Boolean(order.stock_reserved),
    order_items: items.map(normalizeOrderItem),
  }
}

export function getOrderProgress(status: string) {
  if (status === 'CANCELLED') return -1
  return ORDER_FLOW.indexOf(status as OrderStatus)
}

// Strip characters that could manipulate PostgREST filter strings or SQL LIKE patterns
export function sanitizeOrderSearch(value: string) {
  return value.replace(/[.,()!<>=&|%_:*\\]/g, '').trim().slice(0, 120)
}

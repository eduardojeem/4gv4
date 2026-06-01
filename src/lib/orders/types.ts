export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
export type PaymentStatus = 'PENDING' | 'PAID' | 'PARTIAL' | 'REFUNDED' | 'FAILED'
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'DIGITAL_WALLET'
export type FulfillmentType = 'PICKUP' | 'DELIVERY'

export type CustomerOrderItem = {
  id: string
  product_id: string | null
  product_name: string
  product_sku: string | null
  quantity: number
  unit_price: number
  subtotal: number
}

export type CustomerOrder = {
  id: string
  organization_id: string
  customer_id: string | null
  order_number: string
  status: OrderStatus
  payment_status: PaymentStatus
  payment_method: PaymentMethod
  fulfillment_type: FulfillmentType
  customer_name: string
  customer_email: string | null
  customer_phone: string | null
  customer_address: string | null
  subtotal: number
  tax_amount: number
  shipping_cost: number
  discount_amount: number
  total: number
  notes: string | null
  created_at: string
  updated_at: string
  estimated_delivery_date: string | null
  delivered_at: string | null
  cancelled_at: string | null
  stock_reserved: boolean
  order_items: CustomerOrderItem[]
}

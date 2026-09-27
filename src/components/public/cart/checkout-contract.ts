export type PublicCheckoutItem = {
  productId: string
  variantId: string | null
  quantity: number
  unitPrice: number
}

export type PublicOrderRequest = {
  checkoutAttemptId: string
  customer: {
    name: string
    email: string | null
    phone: string | null
    address: string | null
  }
  items: PublicCheckoutItem[]
  fulfillmentType: 'PICKUP' | 'DELIVERY'
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'DIGITAL_WALLET'
  shippingCost: number
  deliveryZoneId: string | null
  deliveryCity: string | null
  deliveryNeighborhood: string | null
  notes: string | null
  promotionCode: string | null
  storeCreditAmount: number
}

export function buildPublicOrderRequest(input: PublicOrderRequest): PublicOrderRequest {
  return input
}

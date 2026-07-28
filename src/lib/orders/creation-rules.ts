import type { FulfillmentType } from '@/lib/orders/types'

export type CatalogPriceProduct = {
  sale_price?: unknown
  offer_price?: unknown
}

export function getCatalogUnitPrice(product: CatalogPriceProduct) {
  const offerPrice = Number(product.offer_price)
  const salePrice = Number(product.sale_price)
  const price = Number.isFinite(offerPrice) && offerPrice > 0 ? offerPrice : salePrice

  return Number.isFinite(price) && price >= 0 ? price : 0
}

export function hasDuplicateProductIds(items: Array<{ productId: string }>) {
  return new Set(items.map((item) => item.productId)).size !== items.length
}

export function validateOrderAmounts(params: {
  subtotal: number
  shippingCost: number
  discountAmount: number
  fulfillmentType: FulfillmentType
}) {
  const { subtotal, shippingCost, discountAmount, fulfillmentType } = params

  if (![subtotal, shippingCost, discountAmount].every(Number.isFinite)) {
    return 'Los importes del pedido no son válidos.'
  }
  if (subtotal < 0 || shippingCost < 0 || discountAmount < 0) {
    return 'Los importes del pedido no pueden ser negativos.'
  }
  if (fulfillmentType === 'PICKUP' && shippingCost !== 0) {
    return 'El retiro en local no puede incluir costo de envío.'
  }
  if (discountAmount > subtotal) {
    return 'El descuento no puede superar el subtotal.'
  }

  return null
}

export function validateDeliveryContact(params: {
  fulfillmentType: FulfillmentType
  phone?: string | null
  address?: string | null
}) {
  if (params.fulfillmentType !== 'DELIVERY') return null
  if (!params.phone?.trim()) return 'Ingresa un teléfono de contacto para el delivery.'
  if (!params.address?.trim()) return 'Ingresa la dirección de entrega.'
  return null
}

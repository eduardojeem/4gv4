import type { CheckoutSettings, PublicCommerceMode } from '@/types/website-settings'

/**
 * Modo que la tienda pública realmente usa.
 *
 * El dueño elige el modo en su configuración, pero el carrito solo funciona si
 * el plan incluye pedidos online: sin ese módulo el servidor rechaza el pedido
 * al confirmar, después de que el cliente armó el carrito y cargó sus datos.
 * En ese caso la tienda atiende por WhatsApp, o queda como catálogo si no hay
 * un número cargado.
 */
export function resolvePublicCommerceMode(
  configured: PublicCommerceMode | undefined,
  options: { ordersEnabled: boolean; hasWhatsapp: boolean },
): PublicCommerceMode {
  const mode = configured ?? 'cart'
  if (mode === 'cart' && !options.ordersEnabled) return options.hasWhatsapp ? 'whatsapp' : 'catalog'
  return mode
}

/**
 * El cobro tal como lo ve el cliente. Además del modo, el delivery depende del
 * módulo de entregas: el servidor rechaza un pedido con delivery sin ese
 * módulo, así que no se ofrece. Si sin delivery no queda ninguna forma de
 * recibir el pedido, el carrito no se puede terminar y la tienda pasa a
 * WhatsApp o catálogo, igual que sin pedidos.
 */
export function resolvePublicCheckout(
  checkout: CheckoutSettings,
  options: { ordersEnabled: boolean; deliveryEnabled: boolean; hasWhatsapp: boolean },
): CheckoutSettings {
  const delivery = options.deliveryEnabled ? checkout.delivery : { ...checkout.delivery, enabled: false }
  const canFulfill = delivery.enabled || checkout.pickup.enabled
  return {
    ...checkout,
    delivery,
    commerceMode: resolvePublicCommerceMode(checkout.commerceMode, {
      ordersEnabled: options.ordersEnabled && canFulfill,
      hasWhatsapp: options.hasWhatsapp,
    }),
  }
}

/** Cuánto le falta al pedido para llegar al mínimo de la tienda; 0 si alcanza o no hay mínimo. */
export function missingForMinimumOrder(minOrderAmount: number | null | undefined, subtotal: number): number {
  const minimum = Number(minOrderAmount) || 0
  return minimum > 0 && subtotal < minimum ? minimum - subtotal : 0
}

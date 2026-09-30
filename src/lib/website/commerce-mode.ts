import type { PublicCommerceMode } from '@/types/website-settings'

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

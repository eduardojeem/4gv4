/**
 * WhatsApp Integration Utilities
 * Provides functions to interact with WhatsApp via web links
 */

import { formatCurrency } from '@/lib/currency'

export interface WhatsAppMessageOptions {
  phone: string
  message?: string
}

/**
 * Formats a phone number for WhatsApp
 * Removes spaces, dashes, and ensures it starts with country code
 */
export function formatWhatsAppPhone(phone: string, defaultCountryCode = '595'): string {
  let cleaned = phone.replace(/\D/g, '')

  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1)
  }

  if (!cleaned.startsWith(defaultCountryCode)) {
    cleaned = defaultCountryCode + cleaned
  } else if (cleaned.startsWith(`${defaultCountryCode}0`)) {
    // Guardado como «595» + «0981…»: el 0 es del formato local y wa.me lo
    // rechaza. Hay números así cargados en las tiendas.
    cleaned = defaultCountryCode + cleaned.slice(defaultCountryCode.length + 1)
  }

  return cleaned
}

/**
 * Generates a WhatsApp Web link
 * Opens WhatsApp with a pre-filled message
 */
export function getWhatsAppLink({ phone, message = '' }: WhatsAppMessageOptions): string {
  const formattedPhone = formatWhatsAppPhone(phone)
  const encodedMessage = encodeURIComponent(message)

  return `https://wa.me/${formattedPhone}${message ? `?text=${encodedMessage}` : ''}`
}

/**
 * Opens WhatsApp in a new window/tab
 */
export function openWhatsApp({ phone, message }: WhatsAppMessageOptions): void {
  const link = getWhatsAppLink({ phone, message })
  window.open(link, '_blank', 'noopener,noreferrer')
}

/**
 * Template messages for common scenarios
 */
export const WhatsAppTemplates = {
  repairStatus: (repairId: string, customerName: string, status: string) =>
    `Hola ${customerName}!\n\nTu reparacion #${repairId} cambio de estado a: *${status}*\n\nNecesitas mas informacion? Estamos para ayudarte.`,

  repairReady: (repairId: string, customerName: string, device: string) =>
    `Buenas noticias ${customerName}!\n\nTu ${device} (Reparacion #${repairId}) ya esta listo para retirar.\n\nPuedes pasar por el local en horario de atencion.`,

  paymentReminder: (customerName: string, amount: number, repairId: string) =>
    `Hola ${customerName},\n\nTe recordamos que tienes un saldo pendiente de *Gs. ${amount.toLocaleString()}* por la reparacion #${repairId}.\n\nPodemos coordinar el pago?`,

  welcomeMessage: (customerName: string) =>
    `Hola ${customerName}!\n\nGracias por contactarnos. Somos 4G Celulares, especialistas en reparacion de dispositivos moviles.\n\nEn que podemos ayudarte hoy?`,

  newRepairNotification: (customerName: string, device: string, issue: string) =>
    `*Nueva reparacion*\n\nCliente: ${customerName}\nDispositivo: ${device}\nProblema: ${issue}\n\nRevisa el sistema para mas detalles.`,

  lowStockAlert: (productName: string, currentStock: number) =>
    `*Alerta de stock bajo*\n\nProducto: ${productName}\nStock actual: ${currentStock} unidades\n\nConsidera realizar pedido.`,

  generalInquiry: () => 'Hola! Quisiera hacer una consulta sobre ',

  trackRepair: (repairId: string) => `Hola! Quisiera consultar sobre el estado de mi reparacion #${repairId}`,

  priceInquiry: (productOrService: string) => `Hola! Quisiera consultar el precio de ${productOrService}`,
}

export type WhatsAppInquiryIntent = 'order' | 'inquiry' | 'price' | 'installments' | 'shipping'

export interface ProductWhatsAppPayload {
  storeName?: string | null
  productName: string
  price: number
  originalPrice?: number | null
  sku?: string | null
  variantName?: string | null
  attributes?: Record<string, string> | null
  quantity?: number
  inStock?: boolean
  stockQuantity?: number | null
  installmentText?: string | null
  productUrl?: string | null
  imageUrl?: string | null
  intent?: WhatsAppInquiryIntent
  customerNote?: string | null
}

/**
 * Builds a clean, professional, and richly formatted WhatsApp message for a product
 * in public organization storefronts.
 */
/** WhatsApp abre enlaces, no rutas: `/tienda/productos/1` llegaba como texto muerto. */
const isOpenableLink = (value: string | null | undefined) => /^https?:\/\//i.test((value ?? '').trim())

export function buildProductWhatsAppMessage(payload: ProductWhatsAppPayload): string {
  const storeGreeting = payload.storeName?.trim()
    ? `¡Hola *${payload.storeName.trim()}*! 👋`
    : '¡Hola! 👋'

  let intentHeader = 'Me interesa este producto de su tienda:'
  if (payload.intent === 'price') {
    // Producto publicado sin precio: es justamente lo que viene a preguntar.
    intentHeader = 'Quiero consultar el precio de este producto:'
  } else if (payload.intent === 'order') {
    intentHeader = '¡Quiero pedir este producto de su tienda online! 🛍️'
  } else if (payload.intent === 'installments') {
    intentHeader = 'Quiero consultar las opciones de financiación y cuotas para este producto:'
  } else if (payload.intent === 'shipping') {
    intentHeader = 'Quiero consultar la disponibilidad y costo de envío para este producto:'
  }

  // Format prices using currency formatter
  const formattedPrice = formatCurrency(payload.price)
  const hasDiscount = payload.originalPrice != null && payload.originalPrice > payload.price
  const formattedOriginal = hasDiscount ? formatCurrency(payload.originalPrice!) : ''
  const discountPercent = hasDiscount
    ? Math.round(((payload.originalPrice! - payload.price) / payload.originalPrice!) * 100)
    : 0

  // Una consulta general (o un producto a presupuestar) no lleva precio: se
  // mandaba «Precio: Gs. 0».
  const hasPrice = Number.isFinite(payload.price) && payload.price > 0
  let priceLine = `💰 *Precio:* ${formattedPrice}`
  if (hasDiscount) {
    priceLine += ` ~(Antes: ${formattedOriginal})~ · *${discountPercent}% OFF*`
  }

  const quantity = Math.max(1, payload.quantity ?? 1)
  const hasMultipleQuantity = quantity > 1
  const totalPrice = payload.price * quantity

  // Format variants or attributes
  let variantText = ''
  if (payload.variantName?.trim()) {
    variantText = `✨ *Opción:* ${payload.variantName.trim()}`
  } else if (payload.attributes && Object.keys(payload.attributes).length > 0) {
    const formattedAttrs = Object.entries(payload.attributes)
      .filter(([k, v]) => Boolean(v) && !['image_url', 'image', 'photo'].includes(k.toLowerCase()))
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ')
    if (formattedAttrs) {
      variantText = `✨ *Opción:* ${formattedAttrs}`
    }
  }

  // Stock status
  let stockText = ''
  if (payload.inStock === false) {
    stockText = '📦 *Estado:* Temporalmente agotado (consultar reposición)'
  } else if (payload.inStock === true) {
    if (typeof payload.stockQuantity === 'number' && payload.stockQuantity > 0) {
      stockText = `📦 *Disponibilidad:* En stock (${payload.stockQuantity} unid.)`
    } else {
      stockText = '📦 *Disponibilidad:* En stock'
    }
  }

  const lines: string[] = [
    storeGreeting,
    intentHeader,
    '',
    `🏷️ *${payload.productName.trim()}*`,
  ]

  if (variantText) {
    lines.push(variantText)
  }

  if (payload.sku?.trim()) {
    lines.push(`🔢 *Código / SKU:* ${payload.sku.trim()}`)
  }

  if (hasPrice) {
    lines.push(priceLine)
  }

  if (hasMultipleQuantity) {
    lines.push(hasPrice
      ? `🛒 *Cantidad:* ${quantity} unid. · *Total:* ${formatCurrency(totalPrice)}`
      : `🛒 *Cantidad:* ${quantity} unid.`)
  }

  if (stockText) {
    lines.push(stockText)
  }

  if (payload.installmentText?.trim()) {
    lines.push(`💳 *Financiación:* ${payload.installmentText.trim()}`)
  }

  if (isOpenableLink(payload.productUrl)) {
    lines.push(`🔗 *Ver producto:* ${payload.productUrl!.trim()}`)
  }

  if (isOpenableLink(payload.imageUrl)) {
    lines.push(`🖼️ *Foto:* ${payload.imageUrl!.trim()}`)
  }

  if (payload.customerNote?.trim()) {
    lines.push('')
    lines.push(`💬 *Nota / Consulta:* ${payload.customerNote.trim()}`)
  }

  lines.push('')
  if (payload.intent === 'order') {
    lines.push('¿Cómo podemos coordinar el pago y la entrega? ¡Muchas gracias!')
  } else if (payload.intent === 'shipping') {
    lines.push('¿Tienen envíos para mi zona y cuál sería el tiempo estimado? ¡Gracias!')
  } else if (payload.intent === 'installments') {
    lines.push('¿Cuáles son las tarjetas y planes en cuotas habilitados? ¡Gracias!')
  } else {
    lines.push('¿Podrían brindarme más información sobre este artículo? ¡Muchas gracias!')
  }

  return lines.join('\n')
}

/**
 * Get business WhatsApp number from environment or config
 */
export function getBusinessWhatsApp(): string {
  return process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS?.trim() || ''
}

/**
 * Quick action to contact business
 */
export function contactBusiness(message?: string): void {
  const phone = getBusinessWhatsApp()
  if (!phone) return

  openWhatsApp({
    phone,
    message: message || WhatsAppTemplates.generalInquiry(),
  })
}


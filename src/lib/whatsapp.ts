/**
 * WhatsApp Integration Utilities
 * Provides functions to interact with WhatsApp via web links
 */

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

/**
 * Get business WhatsApp number from environment or config
 */
export function getBusinessWhatsApp(): string {
  return process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS || '595981123456'
}

/**
 * Quick action to contact business
 */
export function contactBusiness(message?: string): void {
  openWhatsApp({
    phone: getBusinessWhatsApp(),
    message: message || WhatsAppTemplates.generalInquiry(),
  })
}

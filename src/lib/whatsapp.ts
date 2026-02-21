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
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '')
  
  // If phone starts with 0, remove it (common in Paraguay)
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1)
  }
  
  // If phone doesn't start with country code, add it
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
  
  // Use wa.me for universal compatibility (works on mobile and desktop)
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
  // Para clientes
  repairStatus: (repairId: string, customerName: string, status: string) => 
    `Hola ${customerName}! 👋\n\nTu reparación #${repairId} ha cambiado de estado a: *${status}*\n\n¿Necesitas más información? Estamos aquí para ayudarte.`,
  
  repairReady: (repairId: string, customerName: string, device: string) => 
    `¡Buenas noticias ${customerName}! 🎉\n\nTu ${device} (Reparación #${repairId}) ya está listo para retirar.\n\nPuedes pasar por nuestro local en el horario de atención.`,
  
  paymentReminder: (customerName: string, amount: number, repairId: string) => 
    `Hola ${customerName},\n\nTe recordamos que tienes un saldo pendiente de *Gs. ${amount.toLocaleString()}* por la reparación #${repairId}.\n\n¿Podemos coordinar el pago?`,
  
  welcomeMessage: (customerName: string) => 
    `¡Hola ${customerName}! 👋\n\nGracias por contactarnos. Somos 4G Celulares, especialistas en reparación de dispositivos móviles.\n\n¿En qué podemos ayudarte hoy?`,
  
  // Para el negocio
  newRepairNotification: (customerName: string, device: string, issue: string) => 
    `🔔 *Nueva Reparación*\n\nCliente: ${customerName}\nDispositivo: ${device}\nProblema: ${issue}\n\nRevisa el sistema para más detalles.`,
  
  lowStockAlert: (productName: string, currentStock: number) => 
    `⚠️ *Alerta de Stock Bajo*\n\nProducto: ${productName}\nStock actual: ${currentStock} unidades\n\nConsiderar realizar pedido.`,
  
  // Para consultas generales
  generalInquiry: () => 
    `Hola! 👋 Quisiera hacer una consulta sobre `,
  
  trackRepair: (repairId: string) => 
    `Hola! Quisiera consultar sobre el estado de mi reparación #${repairId}`,
  
  priceInquiry: (productOrService: string) => 
    `Hola! Quisiera consultar el precio de ${productOrService}`,
}

/**
 * Get business WhatsApp number from environment or config
 */
export function getBusinessWhatsApp(): string {
  // You can set this in .env.local as NEXT_PUBLIC_WHATSAPP_BUSINESS
  return process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS || '595981123456'
}

/**
 * Quick action to contact business
 */
export function contactBusiness(message?: string): void {
  openWhatsApp({
    phone: getBusinessWhatsApp(),
    message: message || WhatsAppTemplates.generalInquiry()
  })
}

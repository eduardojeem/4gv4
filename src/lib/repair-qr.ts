/**
 * Utilidades para generación y verificación de códigos QR de reparaciones
 */

export interface RepairQRData {
  ticketNumber: string
  customerName: string
  date: string
  hash: string
}

/**
 * Genera un hash de verificación para el comprobante de reparación
 * Usa SHA-256 con un salt basado en datos del ticket
 * 
 * NOTA: Esta función solo funciona en el servidor (Node.js)
 * Para uso en cliente, usar la API endpoint
 */
export function generateRepairHash(
  ticketNumber: string,
  customerName: string,
  date: Date
): string {
  const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD
  const data = `${ticketNumber}|${customerName}|${dateStr}`
  
  // En producción, deberías usar una SECRET_KEY del entorno
  const secret = process.env.REPAIR_QR_SECRET || 'default-secret-change-in-production'
  const combined = `${data}|${secret}`
  
  // Solo disponible en servidor (Node.js)
  if (typeof window === 'undefined') {
    const { createHash } = require('crypto')
    return createHash('sha256')
      .update(combined)
      .digest('hex')
      .substring(0, 16) // Primeros 16 caracteres para mantenerlo compacto
  }
  
  // Fallback para cliente (no seguro, solo para preview)
  // En producción, siempre generar en servidor
  return simpleHash(combined).substring(0, 16)
}

/**
 * Hash simple para uso en cliente (solo preview, no seguro)
 * NO usar para verificación real
 */
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16).padStart(16, '0')
}

/**
 * Verifica si un hash es válido para los datos proporcionados
 */
export function verifyRepairHash(
  ticketNumber: string,
  customerName: string,
  date: Date,
  providedHash: string
): boolean {
  const expectedHash = generateRepairHash(ticketNumber, customerName, date)
  return expectedHash === providedHash
}

/**
 * Obtiene la URL base de la aplicación
 * Prioriza: window.location.origin > NEXT_PUBLIC_APP_URL > localhost
 */
function getBaseURL(): string {
  // En el cliente, usar window.location.origin
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  
  // En el servidor, usar variable de entorno
  return process.env.NEXT_PUBLIC_APP_URL || 
         process.env.NEXT_PUBLIC_BASE_URL || 
         'http://localhost:3000'
}

/**
 * Genera la URL completa para consultar el estado de una reparación
 * Redirige a la página de búsqueda con el ticket pre-cargado
 */
export function generateRepairTrackingURL(
  ticketNumber: string,
  hash: string,
  baseUrl?: string
): string {
  const base = baseUrl || getBaseURL()
  // Redirige directamente a la página de detalle con el hash de verificación
  return `${base}/mis-reparaciones/${ticketNumber}?verify=${hash}`
}

/**
 * Genera los datos completos para el QR del comprobante
 */
export function generateRepairQRData(
  ticketNumber: string,
  customerName: string,
  date: Date
): RepairQRData {
  const hash = generateRepairHash(ticketNumber, customerName, date)
  const dateStr = date.toISOString().split('T')[0]
  
  return {
    ticketNumber,
    customerName,
    date: dateStr,
    hash
  }
}

/**
 * Genera la URL del QR usando la API de qrserver.com
 * Incluye el enlace de seguimiento con hash de verificación
 */
export function generateQRCodeURL(
  ticketNumber: string,
  customerName: string,
  date: Date,
  size: number = 150,
  precomputedHash?: string
): string {
  const hash = precomputedHash || generateRepairHash(ticketNumber, customerName, date)
  const trackingURL = generateRepairTrackingURL(ticketNumber, hash)
  
  // Codificar la URL para el QR
  const qrData = encodeURIComponent(trackingURL)
  
  return `https://api.qrserver.com/v1/create-qr-code/?data=${qrData}&size=${size}x${size}&margin=0&format=png`
}

/**
 * Parsea los datos del QR desde una URL de seguimiento
 */
export function parseTrackingURL(url: string): { ticketNumber: string; hash: string } | null {
  try {
    const urlObj = new URL(url)
    
    // Nuevo formato: /mis-reparaciones?ticket=XXX&verify=YYY
    const ticketNumber = urlObj.searchParams.get('ticket')
    const hash = urlObj.searchParams.get('verify')
    
    if (!ticketNumber || !hash) {
      return null
    }
    
    return { ticketNumber, hash }
  } catch {
    return null
  }
}

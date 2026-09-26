/**
 * Utilidades de URL para los códigos QR de reparaciones. Sirven en cliente y
 * servidor.
 *
 * El hash de verificación vive en `repair-qr-hash.ts`, solo servidor: lleva un
 * secreto y el `crypto` de Node. El cliente lo pide a POST /api/repairs/sign.
 */

export interface RepairQRData {
  ticketNumber: string
  customerName: string
  date: string
  hash: string
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
 * Genera la URL del QR usando la API de qrserver.com
 * Incluye el enlace de seguimiento con hash de verificación.
 *
 * El hash es obligatorio: antes, sin él, se calculaba acá mismo, y en el
 * navegador eso no tiene el secreto.
 */
export function generateQRCodeURL(
  ticketNumber: string,
  hash: string,
  size: number = 150
): string {
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

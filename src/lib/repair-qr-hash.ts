/**
 * Hash de verificación de los comprobantes de reparación. Solo servidor.
 *
 * Vivía en `repair-qr.ts` junto a los helpers de URL, que sí usa el navegador.
 * Por eso el cliente terminaba importando `createHash` del `crypto` de Node:
 * el bundler lo reemplazaba por crypto-browserify —curvas elípticas, RSA, AES,
 * streams—, el chunk de 660 KB de /dashboard/repairs y /dashboard/technician.
 *
 * Y peor que el peso: el hash lleva `REPAIR_QR_SECRET`, que en el navegador no
 * existe. En producción la función lanzaba; en desarrollo firmaba con el
 * secreto de respaldo y daba un hash que el servidor después rechazaba. El
 * cliente pide el hash a POST /api/repairs/sign.
 */

import { createHash } from 'crypto'
import type { RepairQRData } from '@/lib/repair-qr'

function getQRSecret(): string {
  const secret = process.env.REPAIR_QR_SECRET
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('REPAIR_QR_SECRET environment variable is required in production')
  }
  return secret || 'dev-only-qr-secret-not-for-production'
}

/**
 * Genera un hash de verificación para el comprobante de reparación.
 * SHA-256 sobre los datos del ticket y el secreto del servidor.
 */
export function generateRepairHash(
  ticketNumber: string,
  customerName: string,
  date: Date
): string {
  const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD
  const data = `${ticketNumber}|${customerName}|${dateStr}`
  const secret = getQRSecret()
  const combined = `${data}|${secret}`

  return createHash('sha256')
    .update(combined)
    .digest('hex')
    .substring(0, 16) // Primeros 16 caracteres para mantenerlo compacto
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
 * Genera los datos completos para el QR del comprobante
 */
export function generateRepairQRData(
  ticketNumber: string,
  customerName: string,
  date: Date
): RepairQRData {
  return {
    ticketNumber,
    customerName,
    date: date.toISOString().split('T')[0],
    hash: generateRepairHash(ticketNumber, customerName, date),
  }
}

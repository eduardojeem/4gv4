import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  // Usar formato consistente DD/MM/YYYY para evitar problemas de hidratación
  const day = dateObj.getDate().toString().padStart(2, '0')
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0')
  const year = dateObj.getFullYear()
  
  return `${day}/${month}/${year}`
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

/**
 * Formatea un precio en guaraníes paraguayos
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'PYG',
    minimumFractionDigits: 0
  }).format(price)
}

/**
 * Limpia una URL de imagen removiendo caracteres inválidos
 */
export function cleanImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null
  return url.replace(/\)+$/, '').trim()
}

/**
 * Convierte un UUID de cliente a un formato visual corto (ej. CLI-A41149)
 */
export function formatCustomerId(uuid?: string | null): string {
  if (!uuid) return ''
  const shortHex = uuid.split('-')[0].substring(0, 6).toUpperCase()
  return `CLI-${shortHex}`
}

/**
 * Convierte un UUID de crédito a un formato visual corto (ej. CRE-B22391)
 */
export function formatCreditId(uuid?: string | null): string {
  if (!uuid) return ''
  const shortHex = uuid.split('-')[0].substring(0, 6).toUpperCase()
  return `CRE-${shortHex}`
}

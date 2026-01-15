/**
 * Warranty Utilities
 * 
 * Helper functions for warranty management in repairs
 */

import { Repair } from '@/types/repairs'

/**
 * Warranty status types
 */
export type WarrantyStatus = 'active' | 'expiring' | 'expired' | 'none'

/**
 * Warranty type labels in Spanish
 */
export const warrantyTypeLabels = {
  labor: 'Solo mano de obra',
  parts: 'Solo repuestos',
  full: 'Completa (mano de obra + repuestos)'
} as const

/**
 * Warranty months options for select
 */
export const warrantyMonthsOptions = [
  { value: 0, label: 'Sin garantía' },
  { value: 1, label: '1 mes' },
  { value: 3, label: '3 meses' },
  { value: 6, label: '6 meses' },
  { value: 12, label: '1 año' },
  { value: 24, label: '2 años' },
  { value: 36, label: '3 años' }
] as const

/**
 * Calculate warranty expiration date
 * @param completedDate - Date when repair was completed
 * @param warrantyMonths - Number of months of warranty
 * @returns Expiration date
 */
export function calculateWarrantyExpiration(
  completedDate: Date,
  warrantyMonths: number
): Date {
  const expiration = new Date(completedDate)
  expiration.setMonth(expiration.getMonth() + warrantyMonths)
  return expiration
}

/**
 * Get warranty status based on expiration date
 * @param expiresAt - Warranty expiration date
 * @returns Warranty status
 */
export function getWarrantyStatus(expiresAt: Date | string | null): WarrantyStatus {
  if (!expiresAt) return 'none'
  
  const now = new Date()
  const expirationDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt
  const daysRemaining = Math.floor((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  
  if (daysRemaining < 0) return 'expired'
  if (daysRemaining <= 30) return 'expiring'
  return 'active'
}

/**
 * Get days remaining until warranty expires
 * @param expiresAt - Warranty expiration date
 * @returns Number of days remaining (negative if expired)
 */
export function getDaysRemaining(expiresAt: Date | string | null): number {
  if (!expiresAt) return 0
  
  const now = new Date()
  const expirationDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt
  return Math.floor((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Get warranty type label in Spanish
 * @param type - Warranty type
 * @returns Label in Spanish
 */
export function getWarrantyTypeLabel(type: string): string {
  return warrantyTypeLabels[type as keyof typeof warrantyTypeLabels] || type
}

/**
 * Check if warranty is valid (not expired)
 * @param repair - Repair object
 * @returns True if warranty is valid
 */
export function isWarrantyValid(repair: Repair): boolean {
  if (!repair.warranty) return false
  
  // If repair has warranty_expires_at field (from DB)
  const expiresAt = (repair as any).warranty_expires_at
  if (expiresAt) {
    return new Date(expiresAt) > new Date()
  }
  
  // Fallback: check if warranty text exists
  return !!repair.warranty
}

/**
 * Format warranty duration text
 * @param months - Number of months
 * @returns Formatted text
 */
export function formatWarrantyDuration(months: number): string {
  if (months === 0) return 'Sin garantía'
  if (months === 1) return '1 mes'
  if (months < 12) return `${months} meses`
  if (months === 12) return '1 año'
  if (months === 24) return '2 años'
  if (months === 36) return '3 años'
  
  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  
  if (remainingMonths === 0) {
    return `${years} ${years === 1 ? 'año' : 'años'}`
  }
  
  return `${years} ${years === 1 ? 'año' : 'años'} y ${remainingMonths} ${remainingMonths === 1 ? 'mes' : 'meses'}`
}

/**
 * Get warranty status color classes (Modern Design)
 * @param status - Warranty status
 * @returns Tailwind color classes with gradients and modern styling
 */
export function getWarrantyStatusColor(status: WarrantyStatus): {
  bg: string
  text: string
  border: string
  gradient: string
  icon: string
  badge: string
} {
  switch (status) {
    case 'active':
      return {
        bg: 'bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-950/30 dark:via-green-950/30 dark:to-teal-950/30',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-300 dark:border-emerald-700',
        gradient: 'bg-gradient-to-r from-emerald-500 to-teal-500',
        icon: 'text-emerald-600 dark:text-emerald-400',
        badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
      }
    case 'expiring':
      return {
        bg: 'bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/30 dark:via-orange-950/30 dark:to-yellow-950/30',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-300 dark:border-amber-700',
        gradient: 'bg-gradient-to-r from-amber-500 to-orange-500',
        icon: 'text-amber-600 dark:text-amber-400',
        badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
      }
    case 'expired':
      return {
        bg: 'bg-gradient-to-br from-red-50 via-rose-50 to-pink-50 dark:from-red-950/30 dark:via-rose-950/30 dark:to-pink-950/30',
        text: 'text-red-700 dark:text-red-300',
        border: 'border-red-300 dark:border-red-700',
        gradient: 'bg-gradient-to-r from-red-500 to-rose-500',
        icon: 'text-red-600 dark:text-red-400',
        badge: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
      }
    case 'none':
      return {
        bg: 'bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-50 dark:from-slate-950/30 dark:via-gray-950/30 dark:to-zinc-950/30',
        text: 'text-slate-700 dark:text-slate-300',
        border: 'border-slate-300 dark:border-slate-700',
        gradient: 'bg-gradient-to-r from-slate-500 to-gray-500',
        icon: 'text-slate-600 dark:text-slate-400',
        badge: 'bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300'
      }
  }
}

/**
 * Get warranty status label
 * @param status - Warranty status
 * @param daysRemaining - Days remaining (optional)
 * @returns Status label in Spanish
 */
export function getWarrantyStatusLabel(status: WarrantyStatus, daysRemaining?: number): string {
  switch (status) {
    case 'active':
      return daysRemaining !== undefined 
        ? `Activa (${daysRemaining} días restantes)`
        : 'Activa'
    case 'expiring':
      return daysRemaining !== undefined
        ? `Por vencer (${daysRemaining} días)`
        : 'Por vencer'
    case 'expired':
      return 'Vencida'
    case 'none':
      return 'Sin garantía'
  }
}

/**
 * Format warranty expiration date
 * @param expiresAt - Expiration date
 * @returns Formatted date string
 */
export function formatWarrantyExpiration(expiresAt: Date | string | null): string {
  if (!expiresAt) return 'N/A'
  
  const date = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt
  
  return new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date)
}

/**
 * Check if repair should show warranty warning (expiring soon)
 * @param repair - Repair object
 * @returns True if warranty is expiring soon
 */
export function shouldShowWarrantyWarning(repair: Repair): boolean {
  const expiresAt = (repair as any).warranty_expires_at
  if (!expiresAt) return false
  
  const status = getWarrantyStatus(expiresAt)
  return status === 'expiring'
}

/**
 * Get warranty info for receipt
 * @param warrantyMonths - Number of months
 * @param warrantyType - Type of warranty
 * @param warrantyNotes - Additional notes
 * @returns Formatted warranty info for receipt
 */
export function getWarrantyReceiptInfo(
  warrantyMonths: number,
  warrantyType: string,
  warrantyNotes?: string
): string[] {
  const lines: string[] = []
  
  if (warrantyMonths > 0) {
    lines.push(`• Duración: ${formatWarrantyDuration(warrantyMonths)}`)
    lines.push(`• Cubre: ${getWarrantyTypeLabel(warrantyType)}`)
    
    if (warrantyNotes) {
      lines.push(`• ${warrantyNotes}`)
    }
    
    lines.push('• Conserve este comprobante para hacer válida la garantía')
  } else {
    lines.push('• Esta reparación no incluye garantía')
  }
  
  return lines
}

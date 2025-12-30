/**
 * Utilidades para formateo de moneda usando configuración centralizada
 */

import { getCurrencyConfig, getTaxConfig } from './config'

export const formatCurrency = (amount: number): string => {
  const currencyConfig = getCurrencyConfig()
  return new Intl.NumberFormat(currencyConfig.locale, {
    style: 'currency',
    currency: currencyConfig.currency,
    minimumFractionDigits: currencyConfig.minimumFractionDigits,
    maximumFractionDigits: currencyConfig.maximumFractionDigits
  }).format(amount)
}

export const formatCurrencyCompact = (amount: number): string => {
  const currencyConfig = getCurrencyConfig()
  if (amount >= 1000000) {
    return new Intl.NumberFormat(currencyConfig.locale, {
      style: 'currency',
      currency: currencyConfig.currency,
      notation: 'compact',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1
    }).format(amount)
  }
  return formatCurrency(amount)
}

export const parseCurrency = (value: string): number => {
  return parseFloat(value.replace(/[^\d.-]/g, '')) || 0
}

// Configuración de impuestos desde configuración centralizada
export const TAX_RATE = getTaxConfig().rate

export const calculateTax = (amount: number): number => {
  return amount * TAX_RATE
}

export const calculateTotal = (subtotal: number, discount: number = 0): { 
  subtotal: number, 
  discountAmount: number, 
  tax: number, 
  total: number 
} => {
  const discountAmount = subtotal * (discount / 100)
  const taxableAmount = subtotal - discountAmount
  const tax = calculateTax(taxableAmount)
  const total = taxableAmount + tax
  
  return {
    subtotal,
    discountAmount,
    tax,
    total
  }
}
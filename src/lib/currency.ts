/**
 * Utilidad para formateo de moneda configurable
 * Soporta múltiples locales y monedas
 */

// Configuración por defecto (puede ser sobrescrita por variables de entorno)
const DEFAULT_LOCALE = 'es-PY'
const DEFAULT_CURRENCY = 'PYG'

// Obtener configuración desde variables de entorno o usar defaults
export const getLocaleConfig = () => {
  const locale = process.env.NEXT_PUBLIC_LOCALE || DEFAULT_LOCALE
  const currency = process.env.NEXT_PUBLIC_CURRENCY || DEFAULT_CURRENCY
  
  return { locale, currency }
}

/**
 * Formatea un número como moneda usando la configuración del sistema
 */
export const formatCurrency = (amount: number, options?: Intl.NumberFormatOptions): string => {
  const { locale, currency } = getLocaleConfig()
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    ...options
  }).format(amount)
}

/**
 * Formatea un número como moneda compacta (ej: $1.5K, $2.3M)
 */
export const formatCurrencyCompact = (amount: number): string => {
  const { locale, currency } = getLocaleConfig()
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(amount)
}

/**
 * Formatea un número como moneda sin símbolo
 */
export const formatCurrencyValue = (amount: number): string => {
  const { locale } = getLocaleConfig()
  
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount)
}

/**
 * Parsea una cadena de moneda a número
 */
export const parseCurrency = (value: string): number => {
  // Remover símbolos de moneda y separadores
  const cleaned = value.replace(/[^\d.-]/g, '')
  return parseFloat(cleaned) || 0
}

/**
 * Obtiene el símbolo de la moneda configurada
 */
export const getCurrencySymbol = (): string => {
  const { locale, currency } = getLocaleConfig()
  
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol'
  })
  
  // Extraer solo el símbolo
  const parts = formatter.formatToParts(0)
  const symbolPart = parts.find(part => part.type === 'currency')
  
  return symbolPart?.value || currency
}

/**
 * Valida si un valor es una cantidad de moneda válida
 */
export const isValidCurrency = (value: string | number): boolean => {
  if (typeof value === 'number') {
    return !isNaN(value) && isFinite(value) && value >= 0
  }
  
  const parsed = parseCurrency(value)
  return !isNaN(parsed) && isFinite(parsed) && parsed >= 0
}

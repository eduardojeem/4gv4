/**
 * Configuración centralizada del sistema
 * Utiliza variables de entorno para configuración regional y de empresa
 */

export const config = {
  // Configuración regional
  country: process.env.NEXT_PUBLIC_COUNTRY || 'PY',
  currency: process.env.NEXT_PUBLIC_CURRENCY || 'PYG',
  locale: process.env.NEXT_PUBLIC_LOCALE || 'es-PY',
  taxRate: parseFloat(process.env.NEXT_PUBLIC_TAX_RATE || '0.10'),
  // Mostrar precios con IVA incluido (por defecto true)
  pricesIncludeTax: (() => {
    const v = process.env.NEXT_PUBLIC_PRICES_INCLUDE_TAX
    if (v === undefined) return true
    return v === 'true' || v === '1'
  })(),
  
  // Configuración de empresa
  company: {
    name: process.env.NEXT_PUBLIC_COMPANY_NAME || '4G Celulares',
    phone: process.env.NEXT_PUBLIC_COMPANY_PHONE || '+595-21-123456',
    address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || 'Asunción, Paraguay',
    email: 'info@4gcelulares.com',
    logo: process.env.NEXT_PUBLIC_COMPANY_LOGO || undefined
  },
  
  // Configuración de Supabase
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    isConfigured: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_URL !== 'your_supabase_project_url'
    )
  },
  
  // Configuración de la aplicación
  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME || '4G Celulares',
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
    defaultBranchId: process.env.NEXT_PUBLIC_DEFAULT_BRANCH_ID
  },
  
  // Feature Flags - Habilitar/deshabilitar funcionalidades
  features: {
    // Habilitar logging detallado en desarrollo
    enableDetailedLogging: process.env.NODE_ENV === 'development',
    
    // Habilitar retry automático en operaciones de red
    enableAutoRetry: true,
    // Escáner de códigos de barras en POS
    enableBarcodeScanner: true
  }
}

/**
 * Verifica si el sistema está en modo demo
 * FORZADO A FALSE - Sistema en producción con Supabase
 */
export const isDemoMode = (): boolean => {
  return false // Forzado a false para usar Supabase
}

/**
 * Verifica si el usuario habilitó "Modo demo sin BD" en ajustes
 * FORZADO A FALSE - Sistema en producción con Supabase
 */
export const isDemoNoDb = (): boolean => {
  return false // Forzado a false para usar Supabase siempre
}

/**
 * Obtiene la configuración de formateo de moneda
 */
export const getCurrencyConfig = () => ({
  locale: config.locale,
  currency: config.currency,
  minimumFractionDigits: config.currency === 'PYG' ? 0 : 2,
  maximumFractionDigits: config.currency === 'PYG' ? 0 : 2
})

/**
 * Obtiene la configuración de impuestos
 */
export const getTaxConfig = () => ({
  rate: config.taxRate,
  percentage: config.taxRate * 100,
  label: config.country === 'PY' ? 'IVA' : 'Impuesto'
})

/**
 * Verifica si un feature flag está habilitado
 */
export const isFeatureEnabled = (feature: keyof typeof config.features): boolean => {
  return config.features[feature]
}

/**
 * Obtiene el valor de un feature flag con override desde localStorage
 * Permite a los usuarios habilitar/deshabilitar features manualmente
 */
export const getFeatureFlag = (feature: keyof typeof config.features): boolean => {
  try {
    if (typeof window === 'undefined') {
      return config.features[feature]
    }
    
    const storageKey = `feature-flag-${feature}`
    const override = localStorage.getItem(storageKey)
    
    if (override !== null) {
      return override === 'true'
    }
    
    return config.features[feature]
  } catch {
    return config.features[feature]
  }
}

/**
 * Establece un feature flag override en localStorage
 */
export const setFeatureFlag = (feature: keyof typeof config.features, enabled: boolean): void => {
  try {
    if (typeof window !== 'undefined') {
      const storageKey = `feature-flag-${feature}`
      localStorage.setItem(storageKey, String(enabled))
    }
  } catch (error) {
    console.error('Error setting feature flag:', error)
  }
}

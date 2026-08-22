'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { DEFAULT_SYSTEM_COLOR_SCHEME } from '@/lib/theme/color-schemes'
import { setRegionalFormatConfig } from '@/lib/currency'
import { normalizeSupabaseError } from '@/utils/supabase-error'

// Interface matching the database table 'system_settings'
export interface SystemSettingsRow {
  id: string
  company_name: string | null
  company_email: string | null
  company_phone: string | null
  company_ruc: string | null
  company_address: string | null
  city: string | null
  currency: string
  tax_rate: number
  low_stock_threshold: number
  session_timeout: number
  auto_backup: boolean
  email_notifications: boolean
  sms_notifications: boolean
  maintenance_mode: boolean
  allow_registration: boolean
  require_email_verification: boolean
  max_login_attempts: number
  password_min_length: number
  require_two_factor: boolean
  theme: string
  primary_color: string
  date_format: string
  time_zone: string
  language: string
  items_per_page: number
  social_links: Record<string, unknown> | null
  features: Record<string, unknown> | null
  retention_days: number
  updated_at: string
  updated_by: string | null
  default_installment_rates?: Record<string, number>
}

// Shared settings interface used in the application
export interface SharedSettings {
  // Company
  companyName: string
  /** Logo de la organización (para recibos/impresiones). */
  companyLogo: string
  companyEmail: string
  companyPhone: string
  companyRuc: string
  companyAddress: string
  city: string
  currency: string
  taxRate: number
  repairMaxDiscountPercent: number
  repairLaborTaxRate: 0 | 5 | 10

  // Appearance
  theme: string
  primaryColor: string

  // System
  sessionTimeout: number
  lowStockThreshold: number
  autoBackup: boolean
  dateFormat: string
  timeZone: string
  language: string
  itemsPerPage: number
  retentionDays: number

  // Notifications
  emailNotifications: boolean
  smsNotifications: boolean

  // Security
  allowRegistration: boolean
  requireEmailVerification: boolean
  maxLoginAttempts: number
  passwordMinLength: number
  requireTwoFactor: boolean

  // Admin
  maintenanceMode: boolean

  // Defaults
  defaultInstallmentRates: Record<string, number>
}

export type SharedSettingsSource = 'remote' | 'default'

export interface SaveSettingsOptions {
  confirmCurrencyChange?: boolean
}

export const DEFAULT_SHARED_SETTINGS: SharedSettings = {
  companyName: 'Mi Empresa',
  companyLogo: '',
  companyEmail: 'info@empresa.com',
  companyPhone: '',
  companyRuc: '',
  companyAddress: '',
  city: 'Asunción',
  currency: 'PYG',
  taxRate: 10,
  repairMaxDiscountPercent: 20,
  repairLaborTaxRate: 10,
  theme: 'system',
  primaryColor: DEFAULT_SYSTEM_COLOR_SCHEME,
  sessionTimeout: 60,
  lowStockThreshold: 10,
  autoBackup: true,
  dateFormat: 'DD/MM/YYYY',
  timeZone: 'America/Asuncion',
  language: 'es',
  itemsPerPage: 10,
  retentionDays: 90,
  emailNotifications: true,
  smsNotifications: false,
  allowRegistration: false,
  requireEmailVerification: true,
  maxLoginAttempts: 3,
  passwordMinLength: 8,
  requireTwoFactor: false,
  maintenanceMode: false,
  defaultInstallmentRates: {}
}

// ============================================================================
// Mapper
// ============================================================================

function mapToAppSettings(data: SystemSettingsRow): SharedSettings {
  return {
    companyName: data.company_name || DEFAULT_SHARED_SETTINGS.companyName,
    companyLogo: (data as { company_logo?: string | null }).company_logo ?? DEFAULT_SHARED_SETTINGS.companyLogo,
    companyEmail: data.company_email || DEFAULT_SHARED_SETTINGS.companyEmail,
    companyPhone: data.company_phone ?? DEFAULT_SHARED_SETTINGS.companyPhone,
    companyRuc: data.company_ruc ?? DEFAULT_SHARED_SETTINGS.companyRuc,
    companyAddress: data.company_address ?? DEFAULT_SHARED_SETTINGS.companyAddress,
    city: data.city ?? DEFAULT_SHARED_SETTINGS.city,
    currency: data.currency || DEFAULT_SHARED_SETTINGS.currency,
    taxRate: data.tax_rate === null || data.tax_rate === undefined ? DEFAULT_SHARED_SETTINGS.taxRate : Number(data.tax_rate),
    repairMaxDiscountPercent: Number((data as { repair_max_discount_percent?: number }).repair_max_discount_percent ?? DEFAULT_SHARED_SETTINGS.repairMaxDiscountPercent),
    repairLaborTaxRate: ((data as { repair_labor_tax_rate?: 0 | 5 | 10 }).repair_labor_tax_rate ?? DEFAULT_SHARED_SETTINGS.repairLaborTaxRate),
    theme: data.theme || DEFAULT_SHARED_SETTINGS.theme,
    primaryColor: data.primary_color || DEFAULT_SHARED_SETTINGS.primaryColor,
    sessionTimeout: data.session_timeout ?? DEFAULT_SHARED_SETTINGS.sessionTimeout,
    lowStockThreshold: data.low_stock_threshold ?? DEFAULT_SHARED_SETTINGS.lowStockThreshold,
    autoBackup: data.auto_backup ?? DEFAULT_SHARED_SETTINGS.autoBackup,
    dateFormat: data.date_format || DEFAULT_SHARED_SETTINGS.dateFormat,
    timeZone: data.time_zone || DEFAULT_SHARED_SETTINGS.timeZone,
    language: data.language || DEFAULT_SHARED_SETTINGS.language,
    itemsPerPage: data.items_per_page ?? DEFAULT_SHARED_SETTINGS.itemsPerPage,
    retentionDays: data.retention_days ?? DEFAULT_SHARED_SETTINGS.retentionDays,
    emailNotifications: data.email_notifications ?? DEFAULT_SHARED_SETTINGS.emailNotifications,
    smsNotifications: data.sms_notifications ?? DEFAULT_SHARED_SETTINGS.smsNotifications,
    allowRegistration: data.allow_registration ?? DEFAULT_SHARED_SETTINGS.allowRegistration,
    requireEmailVerification: data.require_email_verification ?? DEFAULT_SHARED_SETTINGS.requireEmailVerification,
    maxLoginAttempts: data.max_login_attempts ?? DEFAULT_SHARED_SETTINGS.maxLoginAttempts,
    passwordMinLength: data.password_min_length ?? DEFAULT_SHARED_SETTINGS.passwordMinLength,
    requireTwoFactor: data.require_two_factor ?? DEFAULT_SHARED_SETTINGS.requireTwoFactor,
    maintenanceMode: data.maintenance_mode ?? DEFAULT_SHARED_SETTINGS.maintenanceMode
  }
}

function applyRegionalSettings(settings: Pick<SharedSettings, 'currency' | 'language'>) {
  setRegionalFormatConfig(settings)
}

// ============================================================================
// Hook
// ============================================================================

export function useSharedSettings() {
  const [settings, setSettings] = useState<SharedSettings>(DEFAULT_SHARED_SETTINGS)
  const [originalSettings, setOriginalSettings] = useState<SharedSettings>(DEFAULT_SHARED_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settingsSource, setSettingsSource] = useState<SharedSettingsSource>(
    'default'
  )

  // Track original settings as JSON for efficient comparison
  const originalRef = useRef<string>(JSON.stringify(DEFAULT_SHARED_SETTINGS))

  // Load settings for the current server-resolved organization.
  const loadSettings = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/settings/shared', { cache: 'no-store' })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result?.success || !result?.data) {
        throw new Error(result?.error || `No se pudo cargar la configuración (${response.status})`)
      }

      if (result.data) {
        const mapped = mapToAppSettings(result.data as SystemSettingsRow)
        applyRegionalSettings(mapped)
        setSettings(mapped)
        setOriginalSettings(mapped)
        originalRef.current = JSON.stringify(mapped)
        setSettingsSource('remote')
        return
      }

      // No data in DB — use defaults
      const fallback = DEFAULT_SHARED_SETTINGS
      applyRegionalSettings(fallback)
      setSettings(fallback)
      setOriginalSettings(fallback)
      originalRef.current = JSON.stringify(fallback)
      setSettingsSource('default')
    } catch (err: unknown) {
      const error = normalizeSupabaseError(err)
      console.error('Error loading settings:', error)
      setError(`Error al cargar configuraciones: ${error.message}`)

      setSettings(DEFAULT_SHARED_SETTINGS)
      applyRegionalSettings(DEFAULT_SHARED_SETTINGS)
      setOriginalSettings(DEFAULT_SHARED_SETTINGS)
      originalRef.current = JSON.stringify(DEFAULT_SHARED_SETTINGS)
      setSettingsSource('default')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load from the current tenant context. A global realtime subscription would
  // overwrite tenant-specific values with platform defaults.
  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Efficient change detection using ref instead of JSON.stringify on every render
  const hasChanges = useMemo(() => {
    return JSON.stringify(settings) !== originalRef.current
  }, [settings])

  const updateSetting = useCallback(<K extends keyof SharedSettings>(
    key: K,
    value: SharedSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }, [])

  const updateSettings = useCallback((updates: Partial<SharedSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }))
  }, [])

  const saveSettings = useCallback(async (
    options: SaveSettingsOptions = {}
  ): Promise<{ success: boolean; error?: string }> => {
    setIsSaving(true)
    try {
      // Basic validation
      if (!settings.companyName.trim()) {
        return { success: false, error: 'El nombre de la empresa es requerido' }
      }

      const changedSettings = Object.fromEntries(
        (Object.keys(settings) as Array<keyof SharedSettings>)
          .filter((key) => JSON.stringify(settings[key]) !== JSON.stringify(originalSettings[key]))
          .map((key) => [key, settings[key]])
      ) as Partial<SharedSettings>

      if (Object.keys(changedSettings).length === 0) return { success: true }

      const response = await fetch('/api/admin/system/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: changedSettings,
          confirmCurrencyChange: options.confirmCurrencyChange === true,
        })
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result?.success || !result?.data) {
        throw new Error(result?.error || `No se pudo guardar la configuración (${response.status})`)
      }

      const mapped = mapToAppSettings(result.data as SystemSettingsRow)

      const withOrgData = { ...mapped }
      // El logo no lo administra esta pantalla ni el esquema de guardado, así que
      // la respuesta no lo trae: se preserva el valor actual para que el recibo
      // no pierda el logo hasta la próxima recarga.
      withOrgData.companyLogo = settings.companyLogo

      applyRegionalSettings(withOrgData)
      setSettings(withOrgData)
      setOriginalSettings(withOrgData)
      originalRef.current = JSON.stringify(withOrgData)
      setError(null)
      setSettingsSource('remote')
      return { success: true }
    } catch (err: unknown) {
      const error = normalizeSupabaseError(err)
      console.error('Error saving settings:', error)
      return { success: false, error: error.message || 'Error al guardar las configuraciones' }
    } finally {
      setIsSaving(false)
    }
  }, [originalSettings, settings])

  const resetSettings = useCallback(() => {
    setSettings(originalSettings)
  }, [originalSettings])

  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SHARED_SETTINGS)
  }, [])

  return {
    settings,
    originalSettings,
    hasChanges,
    isLoading,
    isSaving,
    error,
    settingsSource,
    updateSetting,
    updateSettings,
    saveSettings,
    resetSettings,
    resetToDefaults,
    reloadSettings: loadSettings,
  }
}

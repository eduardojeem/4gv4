'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

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
  social_links: any
  features: any
  retention_days: number
  updated_at: string
  updated_by: string | null
}

// Shared settings interface used in the application
export interface SharedSettings {
  // Company
  companyName: string
  companyEmail: string
  companyPhone: string
  companyRuc: string
  companyAddress: string
  city: string
  currency: string
  taxRate: number
  
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
}

const defaultSettings: SharedSettings = {
  companyName: 'Mi Empresa',
  companyEmail: 'info@empresa.com',
  companyPhone: '',
  companyRuc: '',
  companyAddress: '',
  city: 'Asunción',
  currency: 'PYG',
  taxRate: 10,
  theme: 'system',
  primaryColor: 'blue',
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
  maintenanceMode: false
}

const STORAGE_KEY = 'app-shared-settings'

export function useSharedSettings() {
  const [settings, setSettings] = useState<SharedSettings>(defaultSettings)
  const [originalSettings, setOriginalSettings] = useState<SharedSettings>(defaultSettings)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const supabase = createClientComponentClient()

  // Mapper function: Database -> App
  const mapToAppSettings = useCallback((data: SystemSettingsRow): SharedSettings => {
    return {
      companyName: data.company_name || defaultSettings.companyName,
      companyEmail: data.company_email || defaultSettings.companyEmail,
      companyPhone: data.company_phone || defaultSettings.companyPhone,
      companyRuc: data.company_ruc || defaultSettings.companyRuc,
      companyAddress: data.company_address || defaultSettings.companyAddress,
      city: data.city || defaultSettings.city,
      currency: data.currency || defaultSettings.currency,
      taxRate: Number(data.tax_rate) || defaultSettings.taxRate,
      theme: data.theme || defaultSettings.theme,
      primaryColor: data.primary_color || defaultSettings.primaryColor,
      sessionTimeout: data.session_timeout || defaultSettings.sessionTimeout,
      lowStockThreshold: data.low_stock_threshold || defaultSettings.lowStockThreshold,
      autoBackup: data.auto_backup ?? defaultSettings.autoBackup,
      dateFormat: data.date_format || defaultSettings.dateFormat,
      timeZone: data.time_zone || defaultSettings.timeZone,
      language: data.language || defaultSettings.language,
      itemsPerPage: data.items_per_page || defaultSettings.itemsPerPage,
      retentionDays: data.retention_days || defaultSettings.retentionDays,
      emailNotifications: data.email_notifications ?? defaultSettings.emailNotifications,
      smsNotifications: data.sms_notifications ?? defaultSettings.smsNotifications,
      allowRegistration: data.allow_registration ?? defaultSettings.allowRegistration,
      requireEmailVerification: data.require_email_verification ?? defaultSettings.requireEmailVerification,
      maxLoginAttempts: data.max_login_attempts || defaultSettings.maxLoginAttempts,
      passwordMinLength: data.password_min_length || defaultSettings.passwordMinLength,
      requireTwoFactor: data.require_two_factor ?? defaultSettings.requireTwoFactor,
      maintenanceMode: data.maintenance_mode ?? defaultSettings.maintenanceMode
    }
  }, [])

  // Mapper function: App -> Database
  const mapToDbSettings = useCallback((appSettings: SharedSettings): Partial<SystemSettingsRow> => {
    return {
      company_name: appSettings.companyName,
      company_email: appSettings.companyEmail,
      company_phone: appSettings.companyPhone,
      company_ruc: appSettings.companyRuc,
      company_address: appSettings.companyAddress,
      city: appSettings.city,
      currency: appSettings.currency,
      tax_rate: appSettings.taxRate,
      theme: appSettings.theme,
      primary_color: appSettings.primaryColor,
      session_timeout: appSettings.sessionTimeout,
      low_stock_threshold: appSettings.lowStockThreshold,
      auto_backup: appSettings.autoBackup,
      date_format: appSettings.dateFormat,
      time_zone: appSettings.timeZone,
      language: appSettings.language,
      items_per_page: appSettings.itemsPerPage,
      retention_days: appSettings.retentionDays,
      email_notifications: appSettings.emailNotifications,
      sms_notifications: appSettings.smsNotifications,
      allow_registration: appSettings.allowRegistration,
      require_email_verification: appSettings.requireEmailVerification,
      max_login_attempts: appSettings.maxLoginAttempts,
      password_min_length: appSettings.passwordMinLength,
      require_two_factor: appSettings.requireTwoFactor,
      maintenance_mode: appSettings.maintenanceMode,
      updated_at: new Date().toISOString()
    }
  }, [])

  // Load settings from Supabase
  const loadSettings = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('id', 'system')
        .single()

      if (error) throw error

      if (data) {
        const mapped = mapToAppSettings(data as SystemSettingsRow)
        setSettings(mapped)
        setOriginalSettings(mapped)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped))
      }
    } catch (err) {
      console.error('Error loading settings:', err)
      setError('Error al cargar configuraciones')
      // Fallback to localStorage
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          setSettings(parsed)
          setOriginalSettings(parsed)
        } catch (e) {
          console.error('Error parsing local settings:', e)
        }
      }
    } finally {
      setIsLoading(false)
    }
  }, [mapToAppSettings, supabase])

  // Initial load and Real-time subscription
  useEffect(() => {
    loadSettings()

    const channel = supabase
      .channel('system_settings_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'system_settings',
          filter: 'id=eq.system'
        },
        (payload) => {
          console.log('Real-time update received:', payload)
          if (payload.new) {
            const mapped = mapToAppSettings(payload.new as SystemSettingsRow)
            setSettings(mapped)
            setOriginalSettings(mapped)
            localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadSettings, mapToAppSettings, supabase])

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings)

  const updateSetting = useCallback(<K extends keyof SharedSettings>(
    key: K,
    value: SharedSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }, [])

  const updateSettings = useCallback((updates: Partial<SharedSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }))
  }, [])

  const saveSettings = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    setIsSaving(true)
    try {
      // Basic validation
      if (!settings.companyName.trim()) {
        return { success: false, error: 'El nombre de la empresa es requerido' }
      }

      const dbData = mapToDbSettings(settings)
      
      const { error: updateError } = await supabase
        .from('system_settings')
        .update(dbData)
        .eq('id', 'system')

      if (updateError) throw updateError

      setOriginalSettings(settings)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      
      return { success: true }
    } catch (err: any) {
      console.error('Error saving settings:', err)
      return { success: false, error: err.message || 'Error al guardar las configuraciones' }
    } finally {
      setIsSaving(false)
    }
  }, [settings, mapToDbSettings, supabase])

  const resetSettings = useCallback(() => {
    setSettings(originalSettings)
  }, [originalSettings])

  const resetToDefaults = useCallback(() => {
    setSettings(defaultSettings)
  }, [])

  return {
    settings,
    originalSettings,
    hasChanges,
    isLoading,
    isSaving,
    error,
    updateSetting,
    updateSettings,
    saveSettings,
    resetSettings,
    resetToDefaults
  }
}

'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { saveSystemSettingsViaSupabase } from '@/lib/system-settings-client'
import { DEFAULT_SYSTEM_COLOR_SCHEME } from '@/lib/theme/color-schemes'
import type { SystemSettingsPartial } from '@/lib/validations/system-settings'
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

export type SharedSettingsSource = 'remote' | 'cache' | 'default'

export const DEFAULT_SHARED_SETTINGS: SharedSettings = {
  companyName: 'Mi Empresa',
  companyEmail: 'info@empresa.com',
  companyPhone: '',
  companyRuc: '',
  companyAddress: '',
  city: 'Asunción',
  currency: 'PYG',
  taxRate: 10,
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
  maintenanceMode: false
}

// ============================================================================
// Cache
// ============================================================================

const STORAGE_KEY_PREFIX = 'app-shared-settings'
let sharedSettingsCache: SharedSettings | null = null
let cacheTimestamp = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getStorageKey(): string {
  try {
    // Scope localStorage cache to the authenticated user so different users
    // on the same browser never see each other's company data.
    const supabaseKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (supabaseKey) {
      const raw = localStorage.getItem(supabaseKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        const userId = parsed?.user?.id
        if (userId) return `${STORAGE_KEY_PREFIX}-${userId}`
      }
    }
  } catch { /* ignore */ }
  return STORAGE_KEY_PREFIX
}

function isCacheFresh(): boolean {
  return sharedSettingsCache !== null && (Date.now() - cacheTimestamp) < CACHE_TTL
}

function getInitialSettings(): SharedSettings {
  if (sharedSettingsCache) return sharedSettingsCache

  // Try localStorage on first load (scoped per user)
  try {
    const saved = localStorage.getItem(getStorageKey())
    if (saved) {
      const parsed = JSON.parse(saved)
      sharedSettingsCache = parsed
      return parsed
    }
  } catch { /* ignore */ }

  return DEFAULT_SHARED_SETTINGS
}

// ============================================================================
// Mapper
// ============================================================================

function mapToAppSettings(data: SystemSettingsRow): SharedSettings {
  return {
    companyName: data.company_name || DEFAULT_SHARED_SETTINGS.companyName,
    companyEmail: data.company_email || DEFAULT_SHARED_SETTINGS.companyEmail,
    companyPhone: data.company_phone || DEFAULT_SHARED_SETTINGS.companyPhone,
    companyRuc: data.company_ruc || DEFAULT_SHARED_SETTINGS.companyRuc,
    companyAddress: data.company_address || DEFAULT_SHARED_SETTINGS.companyAddress,
    city: data.city || DEFAULT_SHARED_SETTINGS.city,
    currency: data.currency || DEFAULT_SHARED_SETTINGS.currency,
    taxRate: Number(data.tax_rate) || DEFAULT_SHARED_SETTINGS.taxRate,
    theme: data.theme || DEFAULT_SHARED_SETTINGS.theme,
    primaryColor: data.primary_color || DEFAULT_SHARED_SETTINGS.primaryColor,
    sessionTimeout: data.session_timeout || DEFAULT_SHARED_SETTINGS.sessionTimeout,
    lowStockThreshold: data.low_stock_threshold || DEFAULT_SHARED_SETTINGS.lowStockThreshold,
    autoBackup: data.auto_backup ?? DEFAULT_SHARED_SETTINGS.autoBackup,
    dateFormat: data.date_format || DEFAULT_SHARED_SETTINGS.dateFormat,
    timeZone: data.time_zone || DEFAULT_SHARED_SETTINGS.timeZone,
    language: data.language || DEFAULT_SHARED_SETTINGS.language,
    itemsPerPage: data.items_per_page || DEFAULT_SHARED_SETTINGS.itemsPerPage,
    retentionDays: data.retention_days || DEFAULT_SHARED_SETTINGS.retentionDays,
    emailNotifications: data.email_notifications ?? DEFAULT_SHARED_SETTINGS.emailNotifications,
    smsNotifications: data.sms_notifications ?? DEFAULT_SHARED_SETTINGS.smsNotifications,
    allowRegistration: data.allow_registration ?? DEFAULT_SHARED_SETTINGS.allowRegistration,
    requireEmailVerification: data.require_email_verification ?? DEFAULT_SHARED_SETTINGS.requireEmailVerification,
    maxLoginAttempts: data.max_login_attempts || DEFAULT_SHARED_SETTINGS.maxLoginAttempts,
    passwordMinLength: data.password_min_length || DEFAULT_SHARED_SETTINGS.passwordMinLength,
    requireTwoFactor: data.require_two_factor ?? DEFAULT_SHARED_SETTINGS.requireTwoFactor,
    maintenanceMode: data.maintenance_mode ?? DEFAULT_SHARED_SETTINGS.maintenanceMode
  }
}

// ============================================================================
// Hook
// ============================================================================

export function useSharedSettings() {
  const [settings, setSettings] = useState<SharedSettings>(getInitialSettings)
  const [originalSettings, setOriginalSettings] = useState<SharedSettings>(getInitialSettings)
  const [isLoading, setIsLoading] = useState(!isCacheFresh())
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settingsSource, setSettingsSource] = useState<SharedSettingsSource>(
    sharedSettingsCache ? 'cache' : 'default'
  )

  const supabase = useMemo(() => createClient(), [])

  // Track original settings as JSON for efficient comparison
  const originalRef = useRef<string>(JSON.stringify(getInitialSettings()))

  // Load settings from Supabase (stale-while-revalidate pattern)
  const loadSettings = useCallback(async () => {
    // If cache is fresh, skip network fetch
    if (isCacheFresh()) {
      setSettings(sharedSettingsCache!)
      setOriginalSettings(sharedSettingsCache!)
      originalRef.current = JSON.stringify(sharedSettingsCache!)
      setSettingsSource('cache')
      setIsLoading(false)
      return
    }

    // Show cached data immediately while fetching fresh data
    if (sharedSettingsCache) {
      setSettings(sharedSettingsCache)
      setOriginalSettings(sharedSettingsCache)
      setSettingsSource('cache')
    }

    setIsLoading(true)
    setError(null)

    try {
      // Fetch system_settings + org-scoped company data in parallel.
      // system_settings is a global table (single row 'system'), so we overlay
      // the company fields with org-scoped data from organization_settings / branches.
      const [
        { data, error: fetchError },
        { data: orgSettings },
        { data: defaultBranch },
      ] = await Promise.all([
        supabase.from('system_settings').select('*').eq('id', 'system').maybeSingle(),
        supabase.from('organization_settings').select('display_name').maybeSingle(),
        supabase.from('branches').select('phone, email, address, city').eq('is_default', true).maybeSingle(),
      ])

      if (fetchError) throw fetchError

      if (data) {
        const mapped = mapToAppSettings(data as SystemSettingsRow)

        // Overlay company fields with org-scoped sources (higher priority than global system_settings)
        if (orgSettings?.display_name) mapped.companyName = orgSettings.display_name
        if (defaultBranch?.email) mapped.companyEmail = defaultBranch.email
        if (defaultBranch?.phone) mapped.companyPhone = defaultBranch.phone
        if (defaultBranch?.address) mapped.companyAddress = defaultBranch.address
        if (defaultBranch?.city) mapped.city = defaultBranch.city

        sharedSettingsCache = mapped
        cacheTimestamp = Date.now()
        setSettings(mapped)
        setOriginalSettings(mapped)
        originalRef.current = JSON.stringify(mapped)
        setSettingsSource('remote')
        localStorage.setItem(getStorageKey(), JSON.stringify(mapped))
        return
      }

      // No data in DB — use defaults
      sharedSettingsCache = DEFAULT_SHARED_SETTINGS
      cacheTimestamp = Date.now()
      setSettings(DEFAULT_SHARED_SETTINGS)
      setOriginalSettings(DEFAULT_SHARED_SETTINGS)
      originalRef.current = JSON.stringify(DEFAULT_SHARED_SETTINGS)
      setSettingsSource('default')
    } catch (err: unknown) {
      const error = normalizeSupabaseError(err)
      console.error('Error loading settings:', error)
      setError(`Error al cargar configuraciones: ${error.message}`)

      // Fallback to localStorage
      const saved = localStorage.getItem(getStorageKey())
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          sharedSettingsCache = parsed
          setSettings(parsed)
          setOriginalSettings(parsed)
          originalRef.current = JSON.stringify(parsed)
          setSettingsSource('cache')
        } catch {
          setSettings(DEFAULT_SHARED_SETTINGS)
          setOriginalSettings(DEFAULT_SHARED_SETTINGS)
          originalRef.current = JSON.stringify(DEFAULT_SHARED_SETTINGS)
          setSettingsSource('default')
        }
      } else {
        setSettings(DEFAULT_SHARED_SETTINGS)
        setOriginalSettings(DEFAULT_SHARED_SETTINGS)
        originalRef.current = JSON.stringify(DEFAULT_SHARED_SETTINGS)
        setSettingsSource('default')
      }
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  // Initial load + realtime subscription
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
          if (payload.new) {
            const mapped = mapToAppSettings(payload.new as SystemSettingsRow)
            sharedSettingsCache = mapped
            cacheTimestamp = Date.now()
            setSettings(mapped)
            setOriginalSettings(mapped)
            originalRef.current = JSON.stringify(mapped)
            setSettingsSource('remote')
            localStorage.setItem(getStorageKey(), JSON.stringify(mapped))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadSettings, supabase])

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

  const saveSettings = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    setIsSaving(true)
    try {
      // Basic validation
      if (!settings.companyName.trim()) {
        return { success: false, error: 'El nombre de la empresa es requerido' }
      }

      const response = await fetch('/api/admin/system/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      })

      const result = await response.json().catch(() => ({}))
      let persistedSettings = result?.data

      if ((!response.ok || !result?.success || !result?.data) && response.status === 404) {
        persistedSettings = await saveSystemSettingsViaSupabase(supabase, settings as SystemSettingsPartial)
      } else if (!response.ok || !result?.success || !result?.data) {
        throw new Error(result?.error || `No se pudo guardar la configuración (${response.status})`)
      }

      const mapped = mapToAppSettings(persistedSettings as SystemSettingsRow)

      // Sync company fields back to org-scoped tables (fire-and-forget, non-blocking)
      fetch('/api/admin/website/sync-company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: settings.companyName,
          email: settings.companyEmail,
          phone: settings.companyPhone,
          address: settings.companyAddress,
        }),
      }).catch(() => { /* non-blocking */ })

      // Apply org-scoped company values to what we store in state/cache
      const withOrgData = { ...mapped }
      if (settings.companyName) withOrgData.companyName = settings.companyName
      if (settings.companyEmail) withOrgData.companyEmail = settings.companyEmail
      if (settings.companyPhone) withOrgData.companyPhone = settings.companyPhone
      if (settings.companyAddress) withOrgData.companyAddress = settings.companyAddress
      if (settings.city) withOrgData.city = settings.city

      sharedSettingsCache = withOrgData
      cacheTimestamp = Date.now()
      setSettings(withOrgData)
      setOriginalSettings(withOrgData)
      originalRef.current = JSON.stringify(withOrgData)
      setError(null)
      setSettingsSource('remote')
      localStorage.setItem(getStorageKey(), JSON.stringify(withOrgData))

      return { success: true }
    } catch (err: unknown) {
      const error = normalizeSupabaseError(err)
      console.error('Error saving settings:', error)
      return { success: false, error: error.message || 'Error al guardar las configuraciones' }
    } finally {
      setIsSaving(false)
    }
  }, [settings, supabase])

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
    resetToDefaults
  }
}

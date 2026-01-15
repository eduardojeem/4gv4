'use client'

import { useState, useEffect, useCallback } from 'react'

// Tipos compartidos para configuraciones
export interface SharedSettings {
  // Empresa
  companyName: string
  companyEmail: string
  companyPhone: string
  companyAddress: string
  city: string
  currency: string
  taxRate: number
  
  // Apariencia
  theme: string
  colorScheme: string
  
  // Sistema
  sessionTimeout: number
  lowStockThreshold: number
  requireSupplier: boolean
  autoGenerateSKU: boolean
  
  // Notificaciones
  emailNotifications: boolean
  smsNotifications: boolean
  lowStockAlerts: boolean
  salesAlerts: boolean
  
  // Seguridad
  passwordMinLength: number
  requireSpecialChars: boolean
  twoFactorAuth: boolean
  maxLoginAttempts: number
  
  // Sistema (Admin)
  maintenanceMode: boolean
  enableBackups: boolean
  backupFrequency: string
}

const defaultSettings: SharedSettings = {
  companyName: 'Mi Empresa',
  companyEmail: 'info@empresa.com',
  companyPhone: '+595 21 123-4567',
  companyAddress: '',
  city: 'Asunción',
  currency: 'PYG',
  taxRate: 10,
  theme: 'system',
  colorScheme: 'blue',
  sessionTimeout: 60,
  lowStockThreshold: 10,
  requireSupplier: false,
  autoGenerateSKU: true,
  emailNotifications: true,
  smsNotifications: false,
  lowStockAlerts: true,
  salesAlerts: false,
  passwordMinLength: 8,
  requireSpecialChars: true,
  twoFactorAuth: false,
  maxLoginAttempts: 5,
  maintenanceMode: false,
  enableBackups: true,
  backupFrequency: 'daily'
}

const STORAGE_KEY = 'app-shared-settings'

export function useSharedSettings() {
  const [settings, setSettings] = useState<SharedSettings>(defaultSettings)
  const [originalSettings, setOriginalSettings] = useState<SharedSettings>(defaultSettings)
  const [isLoading, setIsLoading] = useState(false)

  // Cargar configuraciones al iniciar
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Intentar cargar desde Supabase primero
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()

        const { data: settingsData, error: settingsError } = await supabase
          .from('system_settings')
          .select('*')
          .eq('id', 'system')
          .single()

        if (!settingsError && settingsData) {
          const { mapDBToSettings } = await import('@/lib/validations/system-settings')
          const mappedSettings = mapDBToSettings(settingsData)
          setSettings(mappedSettings)
          setOriginalSettings(mappedSettings)
          // Guardar en localStorage como cache
          localStorage.setItem(STORAGE_KEY, JSON.stringify(mappedSettings))
          return
        }

        // Si falla Supabase, intentar cargar desde localStorage
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          setSettings(parsed)
          setOriginalSettings(parsed)
          return
        }

        // Si no hay guardado, intentar migrar desde versiones antiguas
        const oldSettings = localStorage.getItem('app-settings-v2')
        if (oldSettings) {
          const parsed = JSON.parse(oldSettings)
          const migrated = { ...defaultSettings, ...parsed }
          setSettings(migrated)
          setOriginalSettings(migrated)
          // Guardar en nuevo formato
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
          return
        }

        // Si no hay nada, usar defaults
        setSettings(defaultSettings)
        setOriginalSettings(defaultSettings)
      } catch (error) {
        console.error('Error loading settings:', error)
        // Intentar cargar desde localStorage como fallback
        try {
          const saved = localStorage.getItem(STORAGE_KEY)
          if (saved) {
            const parsed = JSON.parse(saved)
            setSettings(parsed)
            setOriginalSettings(parsed)
            return
          }
        } catch (e) {
          console.error('Error loading from localStorage:', e)
        }
        setSettings(defaultSettings)
        setOriginalSettings(defaultSettings)
      }
    }

    loadSettings()
  }, [])

  // Detectar cambios
  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings)

  // Actualizar configuración
  const updateSetting = useCallback(<K extends keyof SharedSettings>(
    key: K,
    value: SharedSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }, [])

  // Actualizar múltiples configuraciones
  const updateSettings = useCallback((updates: Partial<SharedSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }))
  }, [])

  // Guardar configuraciones
  const saveSettings = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true)
    try {
      // Validaciones básicas
      if (!settings.companyName.trim()) {
        return { success: false, error: 'El nombre de la empresa es requerido' }
      }

      if (settings.taxRate < 0 || settings.taxRate > 100) {
        return { success: false, error: 'La tasa de impuesto debe estar entre 0 y 100' }
      }

      // Importar dinámicamente para evitar problemas de SSR
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      // Mapear a formato de base de datos
      const { mapSettingsToDB } = await import('@/lib/validations/system-settings')
      const dbData = mapSettingsToDB(settings)

      // Guardar en Supabase
      const { error: supabaseError } = await supabase
        .from('system_settings')
        .update(dbData)
        .eq('id', 'system')

      if (supabaseError) {
        console.error('Error saving to Supabase:', supabaseError)
        // Continuar con localStorage como fallback
      }

      // Guardar en localStorage como backup
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      setOriginalSettings(settings)

      // Disparar evento para notificar otros componentes
      window.dispatchEvent(new CustomEvent('settings-updated', { 
        detail: settings 
      }))

      return { success: true }
    } catch (error) {
      console.error('Error saving settings:', error)
      return { success: false, error: 'Error al guardar las configuraciones' }
    } finally {
      setIsLoading(false)
    }
  }, [settings])

  // Resetear configuraciones
  const resetSettings = useCallback(() => {
    setSettings(originalSettings)
  }, [originalSettings])

  // Resetear a valores por defecto
  const resetToDefaults = useCallback(() => {
    setSettings(defaultSettings)
  }, [])

  // Exportar configuraciones
  const exportSettings = useCallback(() => {
    try {
      const dataStr = JSON.stringify(settings, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `settings-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      return { success: true }
    } catch (error) {
      return { success: false, error: 'Error al exportar configuraciones' }
    }
  }, [settings])

  // Importar configuraciones
  const importSettings = useCallback((file: File): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string)

          // Validar que tenga el formato correcto
          if (typeof imported !== 'object' || imported === null) {
            resolve({ success: false, error: 'Formato de archivo inválido' })
            return
          }

          // Merge con defaults para asegurar que tenga todas las propiedades
          const merged = { ...defaultSettings, ...imported }
          setSettings(merged)

          resolve({ success: true })
        } catch (error) {
          resolve({ success: false, error: 'Error al procesar el archivo' })
        }
      }

      reader.onerror = () => {
        resolve({ success: false, error: 'Error al leer el archivo' })
      }

      reader.readAsText(file)
    })
  }, [])

  return {
    settings,
    originalSettings,
    hasChanges,
    isLoading,
    updateSetting,
    updateSettings,
    saveSettings,
    resetSettings,
    resetToDefaults,
    exportSettings,
    importSettings
  }
}

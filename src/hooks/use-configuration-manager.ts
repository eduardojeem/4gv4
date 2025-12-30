'use client'

import { useState, useCallback, useEffect } from 'react'
import { ConfigurationGroup, ConfigurationState } from '@/types/settings'
import { configurationGroups } from '@/lib/configuration-data'

export function useConfigurationManager() {
  const [state, setState] = useState<ConfigurationState>({
    groups: configurationGroups,
    searchQuery: '',
    activeGroup: null,
    activeSection: null,
    hasUnsavedChanges: false,
    isLoading: false
  })

  // Cargar configuraciones desde localStorage al inicializar
  useEffect(() => {
    const loadSavedSettings = () => {
      try {
        const savedSettings = localStorage.getItem('app-settings')
        if (savedSettings) {
          const settings = JSON.parse(savedSettings)
          
          // Aplicar configuraciones guardadas a los grupos
          const updatedGroups = state.groups.map(group => ({
            ...group,
            sections: group.sections.map(section => ({
              ...section,
              settings: section.settings.map(setting => ({
                ...setting,
                value: settings[setting.key] !== undefined ? settings[setting.key] : setting.value
              }))
            }))
          }))

          setState(prev => ({
            ...prev,
            groups: updatedGroups
          }))
        }
      } catch (error) {
        console.error('Error loading saved settings:', error)
      }
    }

    loadSavedSettings()
  }, [])

  // Función para actualizar una configuración
  const updateSetting = useCallback((settingId: string, value: string | number | boolean | File | null) => {
    setState(prev => {
      const updatedGroups = prev.groups.map(group => ({
        ...group,
        sections: group.sections.map(section => ({
          ...section,
          settings: section.settings.map(setting => 
            setting.id === settingId 
              ? { ...setting, value }
              : setting
          )
        }))
      }))

      return {
        ...prev,
        groups: updatedGroups,
        hasUnsavedChanges: true
      }
    })
  }, [])

  // Función para guardar todas las configuraciones
  const saveSettings = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }))

    try {
      // Recopilar todas las configuraciones en un objeto plano
      const settings: Record<string, any> = {}
      
      state.groups.forEach(group => {
        group.sections.forEach(section => {
          section.settings.forEach(setting => {
            settings[setting.key] = setting.value
          })
        })
      })

      // Guardar en localStorage
      localStorage.setItem('app-settings', JSON.stringify(settings))

      // Simular delay de guardado
      await new Promise(resolve => setTimeout(resolve, 500))

      setState(prev => ({
        ...prev,
        hasUnsavedChanges: false,
        isLoading: false
      }))

      // Disparar evento personalizado para notificar otros componentes
      window.dispatchEvent(new CustomEvent('settings-saved', { detail: settings }))

      return { success: true }
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }))
      console.error('Error saving settings:', error)
      return { success: false, error }
    }
  }, [state.groups])

  // Función para resetear configuraciones a valores por defecto
  const resetSettings = useCallback(() => {
    const resetGroups = configurationGroups.map(group => ({
      ...group,
      sections: group.sections.map(section => ({
        ...section,
        settings: section.settings.map(setting => ({
          ...setting,
          value: setting.defaultValue
        }))
      }))
    }))

    setState(prev => ({
      ...prev,
      groups: resetGroups,
      hasUnsavedChanges: true
    }))
  }, [])

  // Función para exportar configuraciones
  const exportSettings = useCallback(() => {
    const settings: Record<string, any> = {}
    
    state.groups.forEach(group => {
      group.sections.forEach(section => {
        section.settings.forEach(setting => {
          settings[setting.key] = setting.value
        })
      })
    })

    const dataStr = JSON.stringify(settings, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `configuraciones-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [state.groups])

  // Función para importar configuraciones
  const importSettings = useCallback((file: File) => {
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          const settings = JSON.parse(e.target?.result as string)
          
          // Validar que el archivo tenga el formato correcto
          if (typeof settings !== 'object' || settings === null) {
            resolve({ success: false, error: 'Formato de archivo inválido' })
            return
          }

          // Aplicar configuraciones importadas
          const updatedGroups = state.groups.map(group => ({
            ...group,
            sections: group.sections.map(section => ({
              ...section,
              settings: section.settings.map(setting => ({
                ...setting,
                value: settings[setting.key] !== undefined ? settings[setting.key] : setting.value
              }))
            }))
          }))

          setState(prev => ({
            ...prev,
            groups: updatedGroups,
            hasUnsavedChanges: true
          }))

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
  }, [state.groups])

  // Función para obtener estadísticas de configuraciones
  const getStatistics = useCallback(() => {
    let totalSettings = 0
    let modifiedSettings = 0
    let groupsWithChanges = 0

    state.groups.forEach(group => {
      let groupHasChanges = false
      
      group.sections.forEach(section => {
        section.settings.forEach(setting => {
          totalSettings++
          if (setting.value !== setting.defaultValue) {
            modifiedSettings++
            groupHasChanges = true
          }
        })
      })

      if (groupHasChanges) {
        groupsWithChanges++
      }
    })

    return {
      totalSettings,
      modifiedSettings,
      groupsWithChanges,
      totalGroups: state.groups.length,
      totalSections: state.groups.reduce((acc, group) => acc + group.sections.length, 0)
    }
  }, [state.groups])

  return {
    ...state,
    updateSetting,
    saveSettings,
    resetSettings,
    exportSettings,
    importSettings,
    getStatistics,
    setSearchQuery: (query: string) => setState(prev => ({ ...prev, searchQuery: query })),
    setActiveGroup: (groupId: string | null) => setState(prev => ({ ...prev, activeGroup: groupId })),
    setActiveSection: (sectionId: string | null) => setState(prev => ({ ...prev, activeSection: sectionId }))
  }
}
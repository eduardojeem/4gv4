import { useState, useEffect, useCallback } from 'react'

export interface AccessibilitySettings {
  highContrast: boolean
  reducedMotion: boolean
  fontSize: 'small' | 'medium' | 'large' | 'extra-large'
  focusIndicator: boolean
  screenReaderOptimized: boolean
  keyboardNavigation: boolean
  colorBlindFriendly: boolean
}

export interface AccessibilityState {
  settings: AccessibilitySettings
  isLoading: boolean
  hasUnsavedChanges: boolean
}

const DEFAULT_SETTINGS: AccessibilitySettings = {
  highContrast: false,
  reducedMotion: false,
  fontSize: 'medium',
  focusIndicator: true,
  screenReaderOptimized: false,
  keyboardNavigation: true,
  colorBlindFriendly: false
}

export function useAccessibility() {
  const [state, setState] = useState<AccessibilityState>({
    settings: DEFAULT_SETTINGS,
    isLoading: true,
    hasUnsavedChanges: false
  })

  // Cargar configuraciones desde localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('accessibility-settings')
      if (saved) {
        const parsedSettings = JSON.parse(saved)
        setState(prev => ({
          ...prev,
          settings: { ...DEFAULT_SETTINGS, ...parsedSettings },
          isLoading: false
        }))
      } else {
        setState(prev => ({ ...prev, isLoading: false }))
      }
    } catch (error) {
      console.error('Error loading accessibility settings:', error)
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [])

  // Aplicar configuraciones al DOM
  useEffect(() => {
    const { settings } = state
    const root = document.documentElement

    // Alto contraste
    if (settings.highContrast) {
      root.classList.add('high-contrast')
    } else {
      root.classList.remove('high-contrast')
    }

    // Movimiento reducido
    if (settings.reducedMotion) {
      root.classList.add('reduced-motion')
    } else {
      root.classList.remove('reduced-motion')
    }

    // Tamaño de fuente
    root.classList.remove('font-small', 'font-medium', 'font-large', 'font-extra-large')
    root.classList.add(`font-${settings.fontSize}`)

    // Indicador de foco
    if (settings.focusIndicator) {
      root.classList.add('enhanced-focus')
    } else {
      root.classList.remove('enhanced-focus')
    }

    // Optimización para lectores de pantalla
    if (settings.screenReaderOptimized) {
      root.classList.add('screen-reader-optimized')
    } else {
      root.classList.remove('screen-reader-optimized')
    }

    // Navegación por teclado
    if (settings.keyboardNavigation) {
      root.classList.add('keyboard-navigation')
    } else {
      root.classList.remove('keyboard-navigation')
    }

    // Amigable para daltonismo
    if (settings.colorBlindFriendly) {
      root.classList.add('color-blind-friendly')
    } else {
      root.classList.remove('color-blind-friendly')
    }
  }, [state.settings])

  // Actualizar una configuración específica
  const updateSetting = useCallback((key: keyof AccessibilitySettings, value: any) => {
    setState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        [key]: value
      },
      hasUnsavedChanges: true
    }))
  }, [])

  // Guardar configuraciones
  const saveSettings = useCallback(async () => {
    try {
      localStorage.setItem('accessibility-settings', JSON.stringify(state.settings))
      setState(prev => ({ ...prev, hasUnsavedChanges: false }))
      return { success: true }
    } catch (error) {
      console.error('Error saving accessibility settings:', error)
      return { success: false, error: 'Error al guardar configuraciones de accesibilidad' }
    }
  }, [state.settings])

  // Resetear configuraciones
  const resetSettings = useCallback(() => {
    setState(prev => ({
      ...prev,
      settings: DEFAULT_SETTINGS,
      hasUnsavedChanges: true
    }))
  }, [])

  // Detectar preferencias del sistema
  const detectSystemPreferences = useCallback(() => {
    const updates: Partial<AccessibilitySettings> = {}

    // Detectar preferencia de movimiento reducido
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      updates.reducedMotion = true
    }

    // Detectar preferencia de alto contraste
    if (window.matchMedia('(prefers-contrast: high)').matches) {
      updates.highContrast = true
    }

    // Aplicar actualizaciones
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...updates },
      hasUnsavedChanges: Object.keys(updates).length > 0
    }))

    return updates
  }, [])

  // Obtener recomendaciones de accesibilidad
  const getRecommendations = useCallback(() => {
    const recommendations: string[] = []

    if (!state.settings.focusIndicator) {
      recommendations.push('Activar indicadores de foco mejorados para mejor navegación por teclado')
    }

    if (!state.settings.keyboardNavigation) {
      recommendations.push('Habilitar navegación por teclado para usuarios que no usan mouse')
    }

    if (state.settings.fontSize === 'small') {
      recommendations.push('Considerar aumentar el tamaño de fuente para mejor legibilidad')
    }

    if (!state.settings.screenReaderOptimized && state.settings.highContrast) {
      recommendations.push('Activar optimización para lectores de pantalla si usa tecnologías asistivas')
    }

    return recommendations
  }, [state.settings])

  // Verificar compatibilidad del navegador
  const checkBrowserSupport = useCallback(() => {
    const support = {
      reducedMotion: window.matchMedia('(prefers-reduced-motion)').media !== 'not all',
      highContrast: window.matchMedia('(prefers-contrast)').media !== 'not all',
      colorScheme: window.matchMedia('(prefers-color-scheme)').media !== 'not all'
    }

    return support
  }, [])

  return {
    ...state,
    updateSetting,
    saveSettings,
    resetSettings,
    detectSystemPreferences,
    getRecommendations,
    checkBrowserSupport
  }
}
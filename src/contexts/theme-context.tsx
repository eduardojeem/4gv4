'use client'

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react'
import {
  DEFAULT_SYSTEM_COLOR_SCHEME,
  isSystemColorScheme,
  type ThemeColorScheme,
} from '@/lib/theme/color-schemes'
import { normalizePanelStyle, readAppearancePreference, type PanelStyle } from '@/lib/theme/panel-appearance'

/** Lo que dura la transicion de color al cambiar de modo, igual que en el CSS. */
export const THEME_TRANSITION_MS = 260

export type Theme = 'light' | 'dark' | 'system'
export type ColorScheme = ThemeColorScheme

type CustomPalette = {
  primary?: string
  primaryForeground?: string
  accent?: string
  accentForeground?: string
  secondary?: string
  secondaryForeground?: string
  muted?: string
  mutedForeground?: string
  border?: string
  ring?: string
  sidebarPrimary?: string
  success?: string
  successForeground?: string
  warning?: string
  warningForeground?: string
  danger?: string
  dangerForeground?: string
  info?: string
  infoForeground?: string
  neutral?: string
  neutralForeground?: string
}

interface ThemeContextType {
  theme: Theme
  colorScheme: ColorScheme
  setTheme: (theme: Theme) => void
  setColorScheme: (scheme: ColorScheme) => void
  isDark: boolean
  panelStyle: PanelStyle
  setPanelStyle: (style: PanelStyle) => void
  resetAppearance: () => void
  customPalette?: CustomPalette
  setCustomPalette?: (palette: CustomPalette) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
  defaultColorScheme?: ColorScheme
}

export function ThemeProvider({
  children,
  // Claro por defecto: quien nunca eligio tema abre en claro, aunque su sistema
  // este en oscuro. Quien ya eligio conserva su eleccion —incluido 'system',
  // que sigue al sistema operativo—. Tiene que coincidir con `ThemeInitScript`.
  defaultTheme = 'light',
  defaultColorScheme = DEFAULT_SYSTEM_COLOR_SCHEME
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return defaultTheme

    const savedTheme = readAppearancePreference('theme')
    if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') return savedTheme

    const legacyAdminDarkMode = readAppearancePreference('admin-dark-mode')
    if (legacyAdminDarkMode !== null) {
      return legacyAdminDarkMode === 'true' ? 'dark' : 'light'
    }

    return defaultTheme
  })
  const [colorScheme, setColorScheme] = useState<ColorScheme>(() => {
    if (typeof window === 'undefined') return defaultColorScheme
    const saved = readAppearancePreference('colorScheme')
    return saved === 'custom' || saved === 'default' || (saved && isSystemColorScheme(saved)) ? saved as ColorScheme : defaultColorScheme
  })
  const [panelStyle, setPanelStyle] = useState<PanelStyle>(() => normalizePanelStyle(readAppearancePreference('panelStyle')))
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [customPalette, setCustomPaletteState] = useState<CustomPalette | undefined>(() => {
    if (typeof window === 'undefined') return undefined

    const savedCustomPalette = readAppearancePreference('customPalette')
    if (!savedCustomPalette) return undefined

    try {
      const parsed = JSON.parse(savedCustomPalette)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined
    } catch {
      return undefined
    }
  })

  // helper to convert camelCase to kebab-case for CSS variables
  function toKebab(s: string) {
    return s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
  }
  const isDark = theme === 'dark' || (theme === 'system' && systemPrefersDark)

  useEffect(() => {
    const root = window.document.documentElement
    
    // Remove previous theme classes
    root.classList.remove('light', 'dark')
    
    // Apply theme class
    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.add('light')
    }
    
    // Apply color scheme
    root.setAttribute('data-color-scheme', colorScheme)
    root.setAttribute('data-panel-style', panelStyle)
    
    // Apply custom palette overrides when using custom scheme
    const keys: (keyof CustomPalette)[] = [
      'primary',
      'primaryForeground',
      'accent',
      'accentForeground',
      'secondary',
      'secondaryForeground',
      'muted',
      'mutedForeground',
      'border',
      'ring',
      'sidebarPrimary',
      'success',
      'successForeground',
      'warning',
      'warningForeground',
      'danger',
      'dangerForeground',
      'info',
      'infoForeground',
      'neutral',
      'neutralForeground'
    ]

    if (colorScheme === 'custom' && customPalette) {
      keys.forEach((k) => {
        const v = customPalette[k]
        if (typeof v === 'string' && v) root.style.setProperty(`--${toKebab(k)}`, v)
        else root.style.removeProperty(`--${toKebab(k)}`)
      })
      try { localStorage.setItem('customPalette', JSON.stringify(customPalette)) } catch {}
    } else {
      // Clear inline overrides to let scheme CSS take effect
      keys.forEach((k) => {
        root.style.removeProperty(`--${toKebab(k)}`)
      })
    }
    
    // Save to localStorage (no state changes here)
    try {
      localStorage.setItem('theme', theme)
      localStorage.setItem('colorScheme', colorScheme)
      localStorage.setItem('panelStyle', panelStyle)
      localStorage.removeItem('admin-dark-mode')
    } catch {}
  }, [theme, colorScheme, customPalette, isDark, panelStyle])

  const setCustomPalette = useCallback((palette: CustomPalette) => {
    setCustomPaletteState(palette)
    // El efecto aplica la paleta únicamente al seleccionar el esquema custom.
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('customPalette', JSON.stringify(palette))
      } catch {}
    }
  }, [])
  const resetAppearance = useCallback(() => {
    setTheme(defaultTheme)
    setColorScheme(defaultColorScheme)
    setPanelStyle('neutral')
    setCustomPaletteState(undefined)
    try { localStorage.removeItem('customPalette') } catch {}
  }, [defaultTheme, defaultColorScheme])

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === 'theme') setTheme(event.newValue === 'dark' || event.newValue === 'system' ? event.newValue : defaultTheme)
      if (event.key === 'colorScheme') setColorScheme(event.newValue === 'custom' || event.newValue === 'default' || (event.newValue && isSystemColorScheme(event.newValue)) ? event.newValue as ColorScheme : defaultColorScheme)
      if (event.key === 'panelStyle') setPanelStyle(normalizePanelStyle(event.newValue))
      if (event.key === 'customPalette') {
        try {
          const parsed = event.newValue ? JSON.parse(event.newValue) : undefined
          setCustomPaletteState(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined)
        } catch { setCustomPaletteState(undefined) }
      }
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [defaultTheme, defaultColorScheme])

  /**
   * La transición de color acompaña el cambio de modo y se retira enseguida.
   * Antes vivía fija en el <body>: cambiar de tema tenía que animar todos los
   * elementos a la vez —medido, 140-240 ms de bloqueo contra 40 sin ella— y
   * además le ponía 300 ms de retardo a cada cambio de color del día a día.
   */
  const modoAnterior = useRef<boolean | null>(null)
  useEffect(() => {
    const body = window.document.body
    const cambio = modoAnterior.current !== null && modoAnterior.current !== isDark
    modoAnterior.current = isDark
    if (!cambio) return

    body.classList.add('theme-transition')
    const timer = setTimeout(() => body.classList.remove('theme-transition'), THEME_TRANSITION_MS)
    return () => {
      clearTimeout(timer)
      body.classList.remove('theme-transition')
    }
  }, [isDark])

  useEffect(() => {
    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const value = useMemo(
    () => ({
      theme,
      colorScheme,
      setTheme,
      setColorScheme,
      isDark,
      panelStyle,
      setPanelStyle,
      resetAppearance,
      customPalette,
      setCustomPalette
    }),
    [theme, colorScheme, isDark, customPalette, setCustomPalette, panelStyle, resetAppearance]
  )

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

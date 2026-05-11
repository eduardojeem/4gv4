'use client'

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import {
  DEFAULT_SYSTEM_COLOR_SCHEME,
  type ThemeColorScheme,
} from '@/lib/theme/color-schemes'

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
  defaultTheme = 'system',
  defaultColorScheme = DEFAULT_SYSTEM_COLOR_SCHEME
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return defaultTheme

    const savedTheme = localStorage.getItem('theme') as Theme | null
    if (savedTheme) return savedTheme

    const legacyAdminDarkMode = localStorage.getItem('admin-dark-mode')
    if (legacyAdminDarkMode !== null) {
      return legacyAdminDarkMode === 'true' ? 'dark' : 'light'
    }

    return defaultTheme
  })
  const [colorScheme, setColorScheme] = useState<ColorScheme>(() => {
    if (typeof window === 'undefined') return defaultColorScheme
    return (localStorage.getItem('colorScheme') as ColorScheme | null) ?? defaultColorScheme
  })
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [customPalette, setCustomPaletteState] = useState<CustomPalette | undefined>(() => {
    if (typeof window === 'undefined') return undefined

    const savedCustomPalette = localStorage.getItem('customPalette')
    if (!savedCustomPalette) return undefined

    try {
      return JSON.parse(savedCustomPalette)
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
        if (v) root.style.setProperty(`--${toKebab(k)}`, v)
      })
      localStorage.setItem('customPalette', JSON.stringify(customPalette))
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
      localStorage.removeItem('admin-dark-mode')
    } catch {}
  }, [theme, colorScheme, customPalette, isDark])

  const setCustomPalette = useCallback((palette: CustomPalette) => {
    setCustomPaletteState(palette)
    // if currently custom, immediately apply
    if (typeof window !== 'undefined') {
      const root = window.document.documentElement
      Object.entries(palette).forEach(([k, v]) => {
        if (v) root.style.setProperty(`--${toKebab(k)}`, v as string)
      })
      try {
        localStorage.setItem('customPalette', JSON.stringify(palette))
      } catch {}
    }
  }, [])

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
      customPalette,
      setCustomPalette
    }),
    [theme, colorScheme, isDark, customPalette, setCustomPalette]
  )

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

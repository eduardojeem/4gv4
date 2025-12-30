'use client'

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type ColorScheme =
  | 'default'
  | 'blue'
  | 'green'
  | 'purple'
  | 'orange'
  | 'red'
  | 'corporate'
  | 'indigo'
  | 'teal'
  | 'pink'
  | 'amber'
  | 'cyan'
  | 'custom'

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
  defaultColorScheme = 'indigo'
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(defaultTheme)
  const [colorScheme, setColorScheme] = useState<ColorScheme>(defaultColorScheme)
  const [isDark, setIsDark] = useState(false)
  const [customPalette, setCustomPaletteState] = useState<CustomPalette | undefined>(undefined)

  useEffect(() => {
    // Load saved preferences from localStorage
    const savedTheme = localStorage.getItem('theme') as Theme
    const savedColorScheme = localStorage.getItem('colorScheme') as ColorScheme
    const savedCustomPalette = localStorage.getItem('customPalette')
    
    if (savedTheme) {
      setTheme(savedTheme)
    }
    
    if (savedColorScheme) {
      setColorScheme(savedColorScheme)
    }

    if (savedCustomPalette) {
      try {
        const parsed = JSON.parse(savedCustomPalette)
        setCustomPaletteState(parsed)
      } catch {}
    }
  }, [])

  useEffect(() => {
    const root = window.document.documentElement
    
    // Remove previous theme classes
    root.classList.remove('light', 'dark')
    
    // Determine if dark mode should be active
    let shouldBeDark = false
    
    if (theme === 'dark') {
      shouldBeDark = true
    } else if (theme === 'system') {
      shouldBeDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    // Avoid redundant state updates to prevent render loops
    setIsDark(prev => (prev !== shouldBeDark ? shouldBeDark : prev))
    
    // Apply theme class
    if (shouldBeDark) {
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
    } catch {}
  }, [theme, colorScheme])

  // helper to convert camelCase to kebab-case for CSS variables
  function toKebab(s: string) {
    return s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
  }

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
    
    const handleChange = () => {
      if (theme === 'system') {
        setIsDark(mediaQuery.matches)
        const root = window.document.documentElement
        root.classList.remove('light', 'dark')
        root.classList.add(mediaQuery.matches ? 'dark' : 'light')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

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
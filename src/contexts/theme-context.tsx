'use client'

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { usePathname } from 'next/navigation'
import {
  DEFAULT_SYSTEM_COLOR_SCHEME,
  type ThemeColorScheme,
} from '@/lib/theme/color-schemes'
import {
  DEFAULT_MARKETPLACE_THEME,
  PANEL_THEME_STORAGE_KEY,
  PUBLIC_THEME_STORAGE_KEY,
  isThemeMode,
  themeScopeForPath,
  type MarketplaceTheme,
  type ThemeScope,
} from '@/lib/theme/theme-scope'

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

const CUSTOM_PALETTE_KEYS: (keyof CustomPalette)[] = [
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

interface ThemeContextType {
  /** Modo de la zona actual: el del panel, el del marketplace o el del visitante. */
  theme: Theme
  /** Esquema de la zona actual. En tiendas lo pisa la propia tienda en su contenedor. */
  colorScheme: ColorScheme
  setTheme: (theme: Theme) => void
  setColorScheme: (scheme: ColorScheme) => void
  isDark: boolean
  /** En qué zona está la página: el tema del panel solo se aplica en `panel`. */
  scope: ThemeScope
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
  /** Lo que configuró el superadmin para el marketplace. */
  marketplaceTheme?: MarketplaceTheme
}

function toKebab(s: string) {
  return s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}

export function ThemeProvider({
  children,
  // Claro por defecto: quien nunca eligio tema abre en claro, aunque su sistema
  // este en oscuro. Quien ya eligio conserva su eleccion —incluido 'system',
  // que sigue al sistema operativo—. Tiene que coincidir con `ThemeInitScript`.
  defaultTheme = 'light',
  defaultColorScheme = DEFAULT_SYSTEM_COLOR_SCHEME,
  marketplaceTheme = DEFAULT_MARKETPLACE_THEME,
}: ThemeProviderProps) {
  const scope = themeScopeForPath(usePathname())

  // Preferencia personal del panel: la elige cada persona y queda en su navegador.
  const [panelTheme, setPanelTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return defaultTheme

    const savedTheme = localStorage.getItem(PANEL_THEME_STORAGE_KEY) as Theme | null
    if (savedTheme) return savedTheme

    const legacyAdminDarkMode = localStorage.getItem('admin-dark-mode')
    if (legacyAdminDarkMode !== null) {
      return legacyAdminDarkMode === 'true' ? 'dark' : 'light'
    }

    return defaultTheme
  })
  // Modo que eligió el visitante en una tienda. Va aparte: si no, un visitante
  // que pone oscuro en una tienda le cambiaba el panel a quien use ese navegador.
  const [publicTheme, setPublicTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light'
    const saved = localStorage.getItem(PUBLIC_THEME_STORAGE_KEY)
    return isThemeMode(saved) ? saved : 'light'
  })
  const [panelColorScheme, setPanelColorScheme] = useState<ColorScheme>(() => {
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

  const theme: Theme = scope === 'panel'
    ? panelTheme
    : scope === 'marketplace'
      ? marketplaceTheme.mode
      : publicTheme
  const colorScheme: ColorScheme = scope === 'panel'
    ? panelColorScheme
    : scope === 'marketplace'
      ? marketplaceTheme.colorScheme
      : defaultColorScheme
  const usesCustomPalette = scope === 'panel' && colorScheme === 'custom'
  const isDark = theme === 'dark' || (theme === 'system' && systemPrefersDark)

  useEffect(() => {
    const root = window.document.documentElement

    root.classList.remove('light', 'dark')
    root.classList.add(isDark ? 'dark' : 'light')

    root.setAttribute('data-color-scheme', colorScheme)

    // La paleta propia es del panel: fuera de él se limpian los colores en línea
    // para que mande el esquema del marketplace o el de la tienda.
    if (usesCustomPalette && customPalette) {
      CUSTOM_PALETTE_KEYS.forEach((k) => {
        const v = customPalette[k]
        if (v) root.style.setProperty(`--${toKebab(k)}`, v)
      })
    } else {
      CUSTOM_PALETTE_KEYS.forEach((k) => {
        root.style.removeProperty(`--${toKebab(k)}`)
      })
    }
  }, [colorScheme, customPalette, isDark, usesCustomPalette])

  // Guardar en localStorage (no cambia estado).
  useEffect(() => {
    try {
      localStorage.setItem(PANEL_THEME_STORAGE_KEY, panelTheme)
      localStorage.setItem('colorScheme', panelColorScheme)
      localStorage.removeItem('admin-dark-mode')
      if (customPalette) localStorage.setItem('customPalette', JSON.stringify(customPalette))
    } catch {}
  }, [panelTheme, panelColorScheme, customPalette])

  useEffect(() => {
    try {
      localStorage.setItem(PUBLIC_THEME_STORAGE_KEY, publicTheme)
    } catch {}
  }, [publicTheme])

  // Cada zona cambia solo su propio modo. En el marketplace manda el superadmin.
  const setTheme = useCallback((next: Theme) => {
    if (scope === 'panel') setPanelTheme(next)
    else if (scope === 'public') setPublicTheme(next)
  }, [scope])

  const setColorScheme = useCallback((next: ColorScheme) => {
    if (scope === 'panel') setPanelColorScheme(next)
  }, [scope])

  const setCustomPalette = useCallback((palette: CustomPalette) => {
    setCustomPaletteState(palette)
  }, [])

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
      scope,
      customPalette,
      setCustomPalette
    }),
    [theme, colorScheme, setTheme, setColorScheme, isDark, scope, customPalette, setCustomPalette]
  )

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

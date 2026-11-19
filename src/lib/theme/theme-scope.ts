import {
  DEFAULT_SYSTEM_COLOR_SCHEME,
  isSystemColorScheme,
  type SystemColorScheme,
} from '@/lib/theme/color-schemes'

/**
 * El tema se decide por zona de la web, porque cada zona tiene un dueño distinto:
 *
 * - `panel`: lo elige cada persona en su navegador (Apariencia del panel).
 * - `marketplace`: lo define el superadmin para toda la plataforma.
 * - `public`: tiendas y páginas públicas. El color lo pone cada tienda; el modo
 *   claro/oscuro es del visitante y no se mezcla con el del panel.
 *
 * Antes el tema del panel se aplicaba al `<html>` de todas las páginas: quien
 * elegía una paleta en /admin la veía también en el marketplace y en las tiendas.
 */
export type ThemeScope = 'panel' | 'marketplace' | 'public'

export type ThemeMode = 'light' | 'dark' | 'system'

export const PANEL_PATH_PREFIXES = ['/admin', '/dashboard', '/superadmin', '/setup', '/setup-access'] as const
export const MARKETPLACE_PATH_PREFIXES = ['/marketplace', '/empresas'] as const

/** Claves de `localStorage`. La del panel queda como estaba para no perder lo ya elegido. */
export const PANEL_THEME_STORAGE_KEY = 'theme'
export const PUBLIC_THEME_STORAGE_KEY = 'public-theme'

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/** Sin ruta conocida (fuera del router, en pruebas) se comporta como el panel, como antes. */
export function themeScopeForPath(pathname: string | null | undefined): ThemeScope {
  if (pathname == null) return 'panel'
  if (PANEL_PATH_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) return 'panel'
  if (MARKETPLACE_PATH_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) return 'marketplace'
  return 'public'
}

export type MarketplaceTheme = {
  mode: ThemeMode
  colorScheme: SystemColorScheme
}

export const DEFAULT_MARKETPLACE_THEME: MarketplaceTheme = {
  mode: 'light',
  colorScheme: DEFAULT_SYSTEM_COLOR_SCHEME,
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function normalizeMarketplaceTheme(value: unknown): MarketplaceTheme {
  const source = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
  return {
    mode: isThemeMode(source.mode) ? source.mode : DEFAULT_MARKETPLACE_THEME.mode,
    colorScheme: typeof source.colorScheme === 'string' && isSystemColorScheme(source.colorScheme)
      ? source.colorScheme
      : DEFAULT_MARKETPLACE_THEME.colorScheme,
  }
}

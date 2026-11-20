import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const navigation = vi.hoisted(() => ({ pathname: '/admin' as string | null }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useServerInsertedHTML: () => {},
}))

import { ThemeProvider, useTheme } from '@/contexts/theme-context'
import { buildThemeInitScript } from '@/components/util/ThemeInitScript'
import { normalizePlatformBranding } from '@/lib/platform/branding'
import {
  DEFAULT_MARKETPLACE_THEME,
  normalizeMarketplaceTheme,
  themeScopeForPath,
} from '@/lib/theme/theme-scope'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

/**
 * Elegir una paleta en /admin/settings#apariencia cambiaba también el
 * marketplace y las tiendas: el tema del panel se aplicaba al <html> de toda la
 * web. Ahora cada zona tiene su dueño: el panel, cada persona; el marketplace,
 * el superadmin; las tiendas, su propio color.
 */

function Sonda() {
  const { theme, colorScheme, isDark, scope, setTheme } = useTheme()
  return (
    <>
      <p data-testid="estado">{`${scope}:${theme}:${colorScheme}:${isDark ? 'oscuro' : 'claro'}`}</p>
      <button onClick={() => setTheme('dark')}>oscuro</button>
    </>
  )
}

function guardado(valores: Record<string, string>) {
  vi.mocked(window.localStorage.getItem).mockImplementation((key: string) => valores[key] ?? null)
}

const html = () => document.documentElement

describe('cada ruta tiene su zona de tema', () => {
  it.each([
    ['/admin/settings', 'panel'],
    ['/dashboard', 'panel'],
    ['/superadmin/web-content/brand', 'panel'],
    ['/setup-access', 'panel'],
    ['/marketplace', 'marketplace'],
    ['/marketplace/empresas/mi-tienda', 'marketplace'],
    ['/empresas/mi-tienda', 'marketplace'],
    ['/', 'public'],
    ['/mi-tienda/inicio', 'public'],
    ['/administracion', 'public'],
    ['/marketplacex', 'public'],
  ])('%s → %s', (ruta, zona) => {
    expect(themeScopeForPath(ruta)).toBe(zona)
  })

  it('sin ruta conocida se comporta como antes (panel)', () => {
    expect(themeScopeForPath(null)).toBe('panel')
  })
})

describe('el tema del panel no sale del panel', () => {
  beforeEach(() => {
    html().className = ''
    html().removeAttribute('data-color-scheme')
    vi.mocked(window.localStorage.setItem).mockClear()
    guardado({ theme: 'dark', colorScheme: 'pink' })
  })

  it('en el panel manda lo que eligió la persona', () => {
    navigation.pathname = '/admin/settings'
    render(<ThemeProvider><Sonda /></ThemeProvider>)
    expect(screen.getByTestId('estado')).toHaveTextContent('panel:dark:pink:oscuro')
    expect(html().getAttribute('data-color-scheme')).toBe('pink')
    expect(html().classList.contains('dark')).toBe(true)
  })

  it('en el marketplace manda el superadmin', () => {
    navigation.pathname = '/marketplace'
    render(
      <ThemeProvider marketplaceTheme={{ mode: 'light', colorScheme: 'teal' }}>
        <Sonda />
      </ThemeProvider>
    )
    expect(screen.getByTestId('estado')).toHaveTextContent('marketplace:light:teal:claro')
    expect(html().getAttribute('data-color-scheme')).toBe('teal')
    expect(html().classList.contains('dark')).toBe(false)
  })

  it('en el marketplace el visitante no lo cambia', () => {
    guardado({ theme: 'light' })
    navigation.pathname = '/marketplace'
    render(<ThemeProvider><Sonda /></ThemeProvider>)
    act(() => screen.getByText('oscuro').click())
    expect(screen.getByTestId('estado')).toHaveTextContent('marketplace:light:blue:claro')
    expect(window.localStorage.setItem).not.toHaveBeenCalledWith('theme', 'dark')
    expect(window.localStorage.setItem).not.toHaveBeenCalledWith('public-theme', 'dark')
  })

  it('en una tienda no llega la paleta ni el modo del panel', () => {
    navigation.pathname = '/mi-tienda/inicio'
    render(<ThemeProvider><Sonda /></ThemeProvider>)
    expect(screen.getByTestId('estado')).toHaveTextContent('public:light:blue:claro')
    expect(html().getAttribute('data-color-scheme')).toBe('blue')
    expect(html().classList.contains('dark')).toBe(false)
  })

  it('el modo que elige el visitante de una tienda no toca el del panel', () => {
    guardado({ theme: 'light' })
    navigation.pathname = '/mi-tienda/servicios'
    render(<ThemeProvider><Sonda /></ThemeProvider>)
    act(() => screen.getByText('oscuro').click())
    expect(screen.getByTestId('estado')).toHaveTextContent('public:dark:blue:oscuro')
    expect(window.localStorage.setItem).toHaveBeenCalledWith('public-theme', 'dark')
    expect(window.localStorage.setItem).not.toHaveBeenCalledWith('theme', 'dark')
  })
})

describe('el script anti-parpadeo decide igual que el proveedor', () => {
  function correr(ruta: string, valores: Record<string, string>, script = buildThemeInitScript()) {
    window.history.pushState({}, '', ruta)
    html().className = ''
    html().removeAttribute('data-color-scheme')
    guardado(valores)
    new Function(script)()
    return { oscuro: html().classList.contains('dark'), esquema: html().getAttribute('data-color-scheme') }
  }

  it('en el panel usa la elección de la persona', () => {
    expect(correr('/admin', { theme: 'dark', colorScheme: 'pink' })).toEqual({ oscuro: true, esquema: 'pink' })
  })

  it('en el marketplace usa lo del superadmin, aunque el panel esté en oscuro', () => {
    const script = buildThemeInitScript({ mode: 'light', colorScheme: 'teal' })
    expect(correr('/marketplace/productos', { theme: 'dark', colorScheme: 'pink' }, script))
      .toEqual({ oscuro: false, esquema: 'teal' })
  })

  it('en una tienda ignora el panel y respeta al visitante', () => {
    expect(correr('/mi-tienda', { theme: 'dark', colorScheme: 'pink' })).toEqual({ oscuro: false, esquema: null })
    expect(correr('/mi-tienda', { theme: 'light', 'public-theme': 'dark' }).oscuro).toBe(true)
  })
})

describe('el tema del marketplace lo guarda el superadmin', () => {
  it('se normaliza con valores seguros', () => {
    expect(normalizeMarketplaceTheme({ mode: 'dark', colorScheme: 'teal' })).toEqual({ mode: 'dark', colorScheme: 'teal' })
    expect(normalizeMarketplaceTheme({ mode: 'neon', colorScheme: '"><script>' })).toEqual(DEFAULT_MARKETPLACE_THEME)
    expect(normalizePlatformBranding({}).marketplaceTheme).toEqual(DEFAULT_MARKETPLACE_THEME)
  })

  it('una marca guardada en caché por la versión anterior igual trae el tema', () => {
    // getPlatformBranding normaliza al salir del caché: tiene que dar lo mismo
    // pasarla dos veces y completar lo que falte.
    const vieja = { ...normalizePlatformBranding({ platformName: 'Mi plataforma' }) } as Record<string, unknown>
    delete vieja.marketplaceTheme
    const normalizada = normalizePlatformBranding(vieja)
    expect(normalizada.marketplaceTheme).toEqual(DEFAULT_MARKETPLACE_THEME)
    expect(normalizePlatformBranding(normalizada)).toEqual(normalizada)
    expect(leer('src/lib/platform/branding.ts')).toContain('return normalizePlatformBranding(await getCachedPlatformBranding())')
  })

  it('la API lo valida y limpia el caché de la marca al guardar', () => {
    const ruta = leer('src/app/api/superadmin/platform-branding/route.ts')
    expect(ruta).toContain('marketplaceTheme: z.object({')
    expect(ruta).toContain('colorScheme: z.enum(SYSTEM_COLOR_SCHEME_VALUES)')
    expect(ruta).toContain("revalidateTag(PLATFORM_BRANDING_TAG, 'max')")
  })

  it('el layout raíz y el del marketplace lo aplican', () => {
    expect(leer('src/app/layout.tsx')).toContain('marketplaceTheme={marketplaceTheme}')
    expect(leer('src/app/marketplace/layout.tsx')).toContain('data-color-scheme={branding.marketplaceTheme.colorScheme}')
  })
})

describe('la tienda siempre tiene esquema propio', () => {
  it.each(['src/app/(public)/layout.tsx', 'src/app/[organizationSlug]/layout.tsx'])('%s', (ruta) => {
    const layout = leer(ruta)
    expect(layout).toContain("data-color-scheme={brandColor === 'custom' ? DEFAULT_SYSTEM_COLOR_SCHEME : brandColor}")
    expect(layout).not.toContain("brandColor === 'custom' ? undefined : brandColor")
  })

  it('el color de marca propio va después de los esquemas, para ganarles', () => {
    const css = leer('src/app/globals.css')
    const ultimoEsquema = css.lastIndexOf('[data-color-scheme="sky"] {')
    expect(ultimoEsquema).toBeGreaterThan(0)
    expect(css.indexOf('[data-custom-brand] {\n  --primary: var(--brand-primary);')).toBeGreaterThan(ultimoEsquema)
    expect(css.indexOf('.dark [data-custom-brand] {')).toBeGreaterThan(ultimoEsquema)
  })
})

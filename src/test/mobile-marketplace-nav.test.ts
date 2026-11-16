import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  formatMarketplaceLocationChip,
  isMarketplaceTabHighlighted,
  marketplaceBottomTabs,
  marketplaceQuickActivityKeys,
  resolveInitialMarketplaceTab,
} from '../../mobile/src/lib/marketplace-nav-model'

const readMobile = (path: string) => readFileSync(join(__dirname, '../../mobile/src', path), 'utf8')

describe('barra inferior y menú + del marketplace móvil', () => {
  it('define Inicio, Productos, botón central +, Ofertas (en lugar de Tiendas) y Acceder / Mi Perfil', () => {
    const guestTabs = marketplaceBottomTabs({ signedIn: false })
    expect(guestTabs.map((tab) => [tab.key, tab.label, Boolean(tab.isAction)])).toEqual([
      ['inicio', 'Inicio', false],
      ['productos', 'Productos', false],
      ['plus', 'Explorar', true],
      ['ofertas', 'Ofertas', false],
      ['cuenta', 'Acceder', false],
    ])

    const userTabs = marketplaceBottomTabs({ signedIn: true })
    expect(userTabs[4]).toMatchObject({ key: 'cuenta', label: 'Mi Perfil', targetTab: 'perfil' })
  })

  it('calcula correctamente el estado activo con el menú + cerrado y abierto', () => {
    expect(isMarketplaceTabHighlighted('inicio', 'inicio', false)).toBe(true)
    expect(isMarketplaceTabHighlighted('ofertas', 'ofertas', false)).toBe(true)
    expect(isMarketplaceTabHighlighted('cuenta', 'perfil', false)).toBe(true)
    expect(isMarketplaceTabHighlighted('plus', 'inicio', false)).toBe(false)

    // Al abrir el menú Bento +, solo queda destacado el botón central (transformado en X)
    expect(isMarketplaceTabHighlighted('plus', 'inicio', true)).toBe(true)
    expect(isMarketplaceTabHighlighted('inicio', 'inicio', true)).toBe(false)

    // Si está en Tiendas (abierta desde +), no marca erróneamente Ofertas ni otra pestaña
    expect(isMarketplaceTabHighlighted('ofertas', 'tiendas', false)).toBe(false)
    expect(isMarketplaceTabHighlighted('inicio', 'tiendas', false)).toBe(false)
  })

  it('conserva la compatibilidad de redirecciones por query param (?tab=tiendas, ofertas, etc.)', () => {
    expect(resolveInitialMarketplaceTab('ofertas')).toBe('ofertas')
    expect(resolveInitialMarketplaceTab('tiendas')).toBe('tiendas')
    expect(resolveInitialMarketplaceTab('productos')).toBe('productos')
    expect(resolveInitialMarketplaceTab('perfil')).toBe('perfil')
    expect(resolveInitialMarketplaceTab('desconocido')).toBe('inicio')
    expect(resolveInitialMarketplaceTab(undefined)).toBe('inicio')
  })

  it('muestra Mis pedidos y Mis reparaciones solo cuando hay sesión iniciada', () => {
    expect(marketplaceQuickActivityKeys(false)).toEqual([])
    expect(marketplaceQuickActivityKeys(true)).toEqual(['orders', 'appointments', 'repairs'])
  })

  it('formatea el chip de ubicación activa desde facetas reales o fallback seguro', () => {
    const facets = {
      countries: [{ code: 'PY', label: 'Paraguay' }],
      allCities: [{ key: 'PY:asuncion', label: 'Asunción' }],
    }
    expect(formatMarketplaceLocationChip({ country: 'all', city: 'all' }, facets)).toBe('Todas las zonas')
    expect(formatMarketplaceLocationChip({ country: 'PY', city: 'all' }, facets)).toBe('Paraguay')
    expect(formatMarketplaceLocationChip({ country: 'PY', city: 'PY:asuncion' }, facets)).toBe('Asunción')
  })

  it('usa cierre diferido iOS-safe en MarketplaceQuickMenu y lo conecta en index.tsx', () => {
    const quickMenu = readMobile('components/marketplace-quick-menu.tsx')
    expect(quickMenu).toContain('useAfterDismiss')
    expect(quickMenu).toContain('onDismiss={onDismiss}')
    expect(quickMenu).toContain('schedule(action)')
    expect(quickMenu).toContain('Mis pedidos')
    expect(quickMenu).toContain('Mis reparaciones')
    expect(quickMenu).toContain('Buscar productos')
    expect(quickMenu).toContain('Ver tiendas')

    const index = readMobile('app/index.tsx')
    expect(index).toContain('MarketplaceQuickMenu')
    expect(index).toContain('marketplaceBottomTabs')
  })
})

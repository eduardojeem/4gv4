import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  buildPanelGridItems,
  buildPanelQuickActions,
  buildPanelSectionShortcuts,
  filterPanelQuickSearch,
  panelTileShortLabel,
  panelTileTone,
  resolvePinnedShortcutKeys,
  togglePinnedShortcutKey,
} from '../../mobile/src/lib/panel-nav-model'
import type { PanelData, PanelGroup } from '../../mobile/src/lib/panel'

const readMobile = (path: string) => readFileSync(join(__dirname, '../../mobile/src', path), 'utf8')
const readWeb = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8')

const sampleGroups: PanelGroup[] = [
  {
    id: 'primary',
    label: 'Principal',
    items: [
      { key: 'overview', label: 'Resumen', mobileLabel: null, href: '/dashboard', description: 'Estado general' },
      { key: 'pos', label: 'Punto de venta', mobileLabel: 'POS', href: '/dashboard/pos', description: 'Cobrar ventas' },
      { key: 'cash-register', label: 'Caja', mobileLabel: null, href: '/dashboard/pos/caja', description: 'Apertura y cierre' },
      { key: 'agenda', label: 'Agenda', mobileLabel: 'Reservas', href: '/dashboard/agenda', description: 'Turnos' },
    ],
  },
  {
    id: 'sales',
    label: 'Ventas',
    items: [
      { key: 'orders', label: 'Pedidos', mobileLabel: null, href: '/dashboard/orders', description: 'Pedidos web' },
      { key: 'credits', label: 'Créditos', mobileLabel: null, href: '/dashboard/credits', description: 'Cuotas y cobros' },
      { key: 'customers', label: 'Clientes', mobileLabel: null, href: '/dashboard/customers', description: 'Clientes e historial' },
    ],
  },
  {
    id: 'workshop',
    label: 'Taller',
    items: [
      { key: 'repairs', label: 'Reparaciones', mobileLabel: null, href: '/dashboard/repairs', description: 'Órdenes de taller' },
    ],
  },
  {
    id: 'management',
    label: 'Análisis y gestión',
    items: [
      { key: 'administration', label: 'Administración', mobileLabel: null, href: '/admin', description: 'Gestión avanzada' },
    ],
  },
]

const samplePanel = (capabilities: Record<string, boolean>): PanelData => ({
  user: { email: 'a@b.com', name: 'Ana', avatarUrl: null, isAdmin: true, isSuperAdmin: false },
  organization: { id: 'org-1', name: 'TechStore PY', slug: 'techstore', logoUrl: null, role: 'admin', plan: 'Pro' },
  groups: sampleGroups,
  tabs: ['overview', 'pos', 'repairs', 'cash-register'],
  capabilities,
})

describe('navegación personalizable 4+Principales, acciones rápidas y Admin', () => {
  it('ordena secciones por prioridad operativa y excluye overview y administration', () => {
    const grid = buildPanelGridItems(sampleGroups)
    expect(grid.map((item) => item.key)).toEqual([
      'pos',
      'cash-register',
      'repairs',
      'orders',
      'agenda',
      'customers',
      'credits',
    ])
    expect(grid.some((item) => item.key === 'overview' || item.key === 'administration')).toBe(false)

    // En barberías/estéticas (`businessFocus === 'agenda'`), Agenda sube antes de Reparaciones/Pedidos
    const agendaFocusGrid = buildPanelGridItems(sampleGroups, 'agenda')
    expect(agendaFocusGrid.slice(0, 4).map((item) => item.key)).toEqual([
      'pos',
      'cash-register',
      'agenda',
      'repairs',
    ])
  })

  it('usa etiquetas de una palabra para secciones y acciones rápidas', () => {
    expect(panelTileShortLabel({ key: 'repairs', label: 'Reparaciones', mobileLabel: null })).toBe('Taller')
    expect(panelTileShortLabel({ key: 'action:new-repair', label: 'Nueva reparación', mobileLabel: null })).toBe('+ Repar.')
    expect(panelTileShortLabel({ key: 'action:open-cash', label: 'Abrir caja', mobileLabel: null })).toBe('Abrir caja')
    expect(panelTileShortLabel({ key: 'action:new-sale', label: 'Nueva venta', mobileLabel: null })).toBe('+ Venta')
    expect(panelTileShortLabel({ key: 'action:new-order', label: 'Nuevo pedido', mobileLabel: null })).toBe('+ Pedido')
    expect(panelTileShortLabel({ key: 'custom-other', label: 'Auditoría', mobileLabel: null })).toBe('Auditoría')
  })

  it('construye acciones rápidas opcionales estrictamente según permisos reales', () => {
    const fullActions = buildPanelQuickActions(
      samplePanel({
        'repairs.orders.create': true,
        'pos.sales.create': true,
        'ecommerce.orders.manage': true,
        'agenda.create': true,
      })
    )
    expect(fullActions.map((a) => [a.key, a.route])).toEqual([
      ['action:new-repair', '/panel/repairs/new'],
      ['action:open-cash', '/panel/cash-register'],
      ['action:new-sale', '/panel/pos'],
      ['action:new-order', '/panel/orders/new'],
      ['action:new-reservation', '/panel/agenda/form'],
    ])

    // Usuario de solo lectura: no recibe botones de crear reparación, venta, pedido ni turno
    const readOnlyActions = buildPanelQuickActions(samplePanel({}))
    expect(readOnlyActions.map((a) => a.key)).toEqual(['action:open-cash'])
  })

  it('permite personalizar los 4 principales con acciones rápidas e ignora claves revocadas', () => {
    const sections = buildPanelSectionShortcuts(sampleGroups)
    const actions = buildPanelQuickActions(
      samplePanel({
        'repairs.orders.create': true,
        'pos.sales.create': true,
      })
    )
    const available = [...sections, ...actions]

    // Si guardó "Nueva reparación", "Abrir caja" y "Nueva venta", se conservan y filtra cualquier clave inválida
    const resolved = resolvePinnedShortcutKeys(
      ['action:new-repair', 'action:open-cash', 'action:new-sale', 'action:revoked'],
      available,
      sections
    )
    expect(resolved).toEqual(['action:new-repair', 'action:open-cash', 'action:new-sale', 'pos'])

    // Toggle permite quitar o agregar hasta 4, y reemplazar el más antiguo si ya hay 4
    expect(togglePinnedShortcutKey(['pos', 'cash-register'], 'cash-register')).toEqual(['pos'])
    expect(togglePinnedShortcutKey(['pos', 'cash-register'], 'action:new-repair')).toEqual([
      'pos',
      'cash-register',
      'action:new-repair',
    ])
    expect(
      togglePinnedShortcutKey(['pos', 'cash-register', 'repairs', 'orders'], 'action:new-repair')
    ).toEqual(['cash-register', 'repairs', 'orders', 'action:new-repair'])
  })

  it('aplica tintes suaves solo en los primeros 4 bloques', () => {
    expect(panelTileTone(0).lightBg).toBe('#DCFCE7')
    expect(panelTileTone(1).lightBg).toBe('#DBEAFE')
    expect(panelTileTone(2).lightBg).toBe('#CFFAFE')
    expect(panelTileTone(3).lightBg).toBe('#EDE9FE')
    expect(panelTileTone(4).lightBg).toBe('#F8FAFC')
    expect(panelTileTone(4, 'action').lightBg).toBe('#EFF6FF')
  })

  it('busca secciones y acciones rápidas sin distinguir tildes o mayúsculas', () => {
    const actions = buildPanelQuickActions(
      samplePanel({ 'repairs.orders.create': true, 'pos.sales.create': true, 'ecommerce.orders.manage': true })
    )
    const matches = filterPanelQuickSearch(sampleGroups, 'nueva reparacion', actions)
    expect(matches.map((m) => m.key)).toContain('action:new-repair')
    expect(filterPanelQuickSearch(sampleGroups, 'creditos', actions).map((m) => m.key)).toEqual(['credits'])
  })

  it('conecta 4 principales, Cambiar, Ver todas, acciones rápidas y Administración destacada en app y web', () => {
    const quickMenu = readMobile('components/panel-quick-menu.tsx')
    const chrome = readMobile('components/panel-chrome.tsx')
    const menus = readMobile('components/panel-menus.tsx')
    const webNav = readWeb('components/dashboard/mobile-nav.tsx')

    for (const file of [quickMenu, webNav]) {
      expect(file).toContain('PRINCIPALES')
      expect(file).toContain('Cambiar')
      expect(file).toContain('Ver todas las secciones')
      expect(file).toContain('Ir a Administración')
      expect(file).toContain('ACCIONES RÁPIDAS')
    }

    expect(quickMenu).toContain('onDismiss={onDismiss}')
    expect(quickMenu).toContain('schedule(onOpenSections)')
    expect(chrome).toContain('openQuickMenu')
    expect(chrome).toContain('openSections')
    expect(chrome).toContain("label: 'Más'")
    expect(chrome).not.toContain('¿Qué querés crear?')
    expect(chrome).not.toContain("label: 'Crear'")
    expect(menus).toContain("open === 'quick'")
    expect(menus).toContain('activeMenu: open')
    expect(webNav).toContain("if (pathname === '/dashboard/pos') return null")
    expect(webNav).toContain('id="dashboard-quick-menu"')
  })
})

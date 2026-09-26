import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  describeAnalyticsSections,
  filterInsightsByModules,
  isHeadlineCardVisible,
  resolveAnalyticsModules,
  revenueCardId,
} from '@/components/admin/reports/analytics-modules'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const TABLERO = leer('src/components/admin/reports/analytics-dashboard.tsx')

const ROPA = resolveAnalyticsModules('active', ['inventory', 'pos', 'crm', 'orders', 'ecommerce', 'analytics'])
const SERVICIOS = resolveAnalyticsModules('active', ['crm', 'services', 'pos', 'analytics'])
const TALLER = resolveAnalyticsModules('active', ['inventory', 'pos', 'crm', 'repairs', 'services', 'analytics'])

describe('analytics muestra lo que usa la empresa', () => {
  it('lee los modulos activos', () => {
    expect(ROPA).toEqual({ repairs: false, inventory: true, crm: true })
    expect(SERVICIOS).toEqual({ repairs: false, inventory: false, crm: true })
    expect(TALLER).toEqual({ repairs: true, inventory: true, crm: true })
  })

  it('mientras carga la suscripcion no esconde nada', () => {
    expect(resolveAnalyticsModules(null, [])).toEqual({ repairs: true, inventory: true, crm: true })
  })

  it('saca los avisos de modulos apagados y deja los generales', () => {
    const avisos = [
      { id: 'growth' },
      { id: 'cash-risk' },
      { id: 'inventory-risk' },
      { id: 'repair-backlog' },
      { id: 'repeat-customers' },
    ]
    expect(filterInsightsByModules(avisos, ROPA).map((a) => a.id)).toEqual([
      'growth', 'cash-risk', 'inventory-risk', 'repeat-customers',
    ])
    expect(filterInsightsByModules(avisos, SERVICIOS).map((a) => a.id)).toEqual([
      'growth', 'cash-risk', 'repeat-customers',
    ])
    expect(filterInsightsByModules(avisos, TALLER)).toHaveLength(5)
  })

  it('sin taller la facturacion es la de POS, la misma de Reportes', () => {
    expect(revenueCardId(ROPA)).toBe('pos-revenue')
    expect(revenueCardId(TALLER)).toBe('gross')
    expect(isHeadlineCardVisible('gross', ROPA)).toBe(false)
    expect(isHeadlineCardVisible('repairs', ROPA)).toBe(false)
    expect(isHeadlineCardVisible('pos-revenue', ROPA)).toBe(true)
    expect(isHeadlineCardVisible('gross', TALLER)).toBe(true)
  })

  it('el subtitulo nombra solo las secciones que hay', () => {
    expect(describeAnalyticsSections(TALLER)).toBe('Ventas, dinero, inventario, clientes y taller')
    expect(describeAnalyticsSections(ROPA)).toBe('Ventas, dinero, inventario y clientes')
    expect(describeAnalyticsSections(SERVICIOS)).toBe('Ventas, dinero y clientes')
  })

  it('las pestanas de inventario, clientes y taller dependen de su modulo', () => {
    expect(TABLERO).toContain("{ id: 'inventario', label: 'Inventario', icon: Boxes, module: 'inventory' }")
    expect(TABLERO).toContain("{ id: 'clientes', label: 'Clientes', icon: Users, module: 'crm' }")
    expect(TABLERO).toContain("{ id: 'taller', label: 'Taller', icon: Wrench, module: 'repairs' }")
    expect(TABLERO).toContain('const visibleTabs = TABS.filter((item) => !item.module || modules[item.module])')
  })

  it('sin taller no se dibuja ni se exporta lo del taller', () => {
    expect(TABLERO).toContain('showRepairs={modules.repairs}')
    expect(TABLERO).toContain("...(modules.repairs ? [repairsRef] : [])")
    expect(TABLERO).toContain("...(modules.repairs ? ['Estados de reparación'] : [])")
  })
})

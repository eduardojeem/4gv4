import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  availablePosDashboardTabs,
  resolveActiveTab,
  showsSection,
} from './dashboard-tabs'

const valores = (modules: string[]) => availablePosDashboardTabs(modules).map((tab) => tab.value)
const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

/**
 * Las pestañas eran cuatro botones fijos: «Reparaciones (Taller)» aparecia en
 * organizaciones sin taller y los creditos no tenian pestaña propia.
 */
describe('las pestañas dependen de los módulos de la organización', () => {
  it('sin taller ni créditos quedan las tres de siempre', () => {
    expect(valores(['pos', 'inventory'])).toEqual(['all', 'sales', 'profit'])
  })

  it('con taller aparece Reparaciones, pero no Créditos', () => {
    expect(valores(['pos', 'repairs'])).toEqual(['all', 'sales', 'repairs', 'profit'])
  })

  it('con créditos aparece su pestaña, antes que el taller', () => {
    expect(valores(['pos', 'credits', 'repairs'])).toEqual(['all', 'sales', 'credits', 'repairs', 'profit'])
  })

  it('los nombres son los que ve el usuario', () => {
    const tabs = availablePosDashboardTabs(['credits', 'repairs'])
    expect(tabs.find((t) => t.value === 'credits')?.label).toBe('Créditos')
    expect(tabs.find((t) => t.value === 'repairs')?.label).toBe('Reparaciones (Taller)')
  })

  it('usa la misma regla que el menú lateral para Reparaciones', () => {
    // Si el menu oculta Reparaciones, el dashboard tampoco puede mostrarla.
    const sidebar = leer('src/components/dashboard/sidebar.tsx')
    expect(sidebar).toContain("href: '/dashboard/repairs', icon: Wrench, permission: 'repairs.read', requiredModule: 'repairs'")
    expect(leer('src/app/dashboard/pos/dashboard/lib/dashboard-tabs.ts')).toContain('isNavigationModuleAvailable(tab.requiredModule, effectiveModules)')
  })
})

describe('una pestaña que dejó de estar disponible', () => {
  it('vuelve a la vista general en vez de mostrar un dashboard vacío', () => {
    const sinTaller = availablePosDashboardTabs(['pos'])
    expect(resolveActiveTab('repairs', sinTaller)).toBe('all')
    expect(resolveActiveTab('credits', sinTaller)).toBe('all')
    expect(resolveActiveTab('profit', sinTaller)).toBe('profit')
  })

  it('una sección se ve en su pestaña y en la vista general', () => {
    expect(showsSection('credits', 'all')).toBe(true)
    expect(showsSection('credits', 'credits')).toBe(true)
    expect(showsSection('credits', 'sales')).toBe(false)
  })
})

describe('la página respeta los módulos', () => {
  const page = leer('src/app/dashboard/pos/dashboard/page.tsx')

  it('el taller solo se dibuja con el módulo de reparaciones', () => {
    expect(page).toContain("hasRepairs && showsSection('repairs', viewTab)")
    expect(page).toContain('showRepairs={hasRepairs}')
  })

  it('los créditos solo se dibujan con su módulo y ya no viven dentro de Ventas', () => {
    expect(page).toContain("hasCredits && showsSection('credits', viewTab)")
    expect(page).toContain("hasCredits && viewTab === 'credits'")
  })

  it('los créditos del taller solo se muestran si hay taller', () => {
    expect(page).toContain('repairCredits={hasRepairs ? stats.repairCreditStats : null}')
  })

  it('no queda ninguna sección decidida por la pestaña cruda', () => {
    // `activeViewTab` puede apuntar a una pestaña ya no disponible; lo que
    // decide que se ve es `viewTab`.
    expect(page).not.toContain('activeViewTab ===')
  })
})

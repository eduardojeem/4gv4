import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { adminNavCategories } from '@/config/admin-navigation'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const HOOK = leer('src/hooks/use-admin-nav-badges.ts')
const LAYOUT = leer('src/components/admin/layout/AdminLayout.tsx')
const SHELL = leer('src/components/admin/layout/admin-shell.tsx')

/**
 * El monitor de cajas es la unica seccion que genera alertas, y no habia forma
 * de enterarse sin entrar: la pantalla tiene su globito, el menu no mostraba
 * nada. Con doce alertas criticas el menu se veia igual que un dia tranquilo.
 */
describe('el menu avisa cuando hay alertas de caja', () => {
  it('el item del monitor declara su contador', () => {
    const operaciones = adminNavCategories.find((category) => category.id === 'operations')
    const monitor = operaciones?.items.find((item) => item.key === 'cash-monitor')

    expect(monitor).toBeDefined()
    expect(monitor?.badge).toBe('cash-alerts')
  })

  it('ningun otro item declara uno todavia', () => {
    // Si algun dia se agrega, que sea a proposito y no por copiar y pegar.
    const conBadge = adminNavCategories
      .flatMap((category) => category.items)
      .filter((item) => item.badge)
      .map((item) => item.key)

    expect(conBadge).toEqual(['cash-monitor'])
  })

  it('el numero no vive en la configuracion', () => {
    // La config dice DE DONDE sacarlo; el numero cambia solo.
    const CONFIG = leer('src/config/admin-navigation.ts')
    expect(CONFIG).toContain("export type NavBadgeKey = 'cash-alerts'")
    expect(CONFIG).toContain('badge?: NavBadgeKey')
  })
})

describe('el contador sale de la base, no de una lista', () => {
  it('cuenta sin traer las filas', () => {
    expect(HOOK).toContain("select('id', { count: 'exact', head: true })")
    expect(HOOK).toContain(".eq('is_resolved', false)")
  })

  it('respeta la tienda y la sucursal elegidas', () => {
    expect(HOOK).toContain(".eq('organization_id', organization.id)")
    expect(HOOK).toContain('withBranchFilter(query, selectedBranchId)')
  })

  it('se actualiza cuando entra una alerta, sin recargar', () => {
    // Es justo el momento en que sirve.
    expect(HOOK).toContain("table: 'cash_alerts',")
    expect(HOOK).toContain('filter: `organization_id=eq.${organization.id}`')
  })

  it('un contador que falla no rompe el menu', () => {
    expect(HOOK).toContain('if (error) return')
    expect(HOOK).toContain('} catch {')
  })
})

/**
 * Verificado en el navegador a 1100px, en claro y oscuro: expandido sale el
 * numero a la derecha del nombre, y plegado un punto en la esquina del icono.
 */
describe('los dos menus lo pintan', () => {
  it('el que se usa hoy', () => {
    expect(LAYOUT).toContain('const navBadges = useAdminNavBadges()')
    expect(LAYOUT).toContain('const pendientes = badge ? navBadges[badge] ?? 0 : 0')
  })

  it('y el otro, para que no se separen', () => {
    expect(SHELL).toContain('const navBadges = useAdminNavBadges()')
    expect(SHELL).toContain('const pendientes = badge ? navBadges[badge] ?? 0 : 0')
  })

  it('plegado el numero no entra, pero el punto se ve igual', () => {
    // Es todo el sentido de esto: que se note sin abrir el menu.
    expect(LAYOUT).toContain('{collapsed && pendientes > 0 && (')
    expect(SHELL).toContain('{collapsed && pendientes > 0 && (')
  })

  it('un color no se lee: el nombre accesible dice el numero', () => {
    expect(LAYOUT).toContain('aria-label={pendientes > 0 ? `${label}: ${pendientes} sin resolver` : undefined}')
    expect(SHELL).toContain('aria-label={pendientes > 0 ? `${label}: ${pendientes} sin resolver` : undefined}')
  })

  it('con muchas alertas el numero no desarma la fila', () => {
    expect(LAYOUT).toContain("{pendientes > 99 ? '99+' : pendientes}")
    expect(SHELL).toContain("{pendientes > 99 ? '99+' : pendientes}")
  })
})

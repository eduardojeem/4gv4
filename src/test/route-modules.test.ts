import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROUTE_MODULES, isRouteAvailable, requirementForPath } from '@/lib/navigation/route-modules'
import { adminNavCategories } from '@/config/admin-navigation'
import { dashboardNavGroups } from '@/config/dashboard-navigation'

const RAIZ = process.cwd()

/** Todas las rutas con página bajo un directorio de src/app. */
function paginas(dir: string): string[] {
  const out: string[] = []
  const walk = (current: string) => {
    for (const name of readdirSync(current)) {
      const full = join(current, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (name === 'page.tsx') {
        const route = '/' + relative(join(RAIZ, 'src/app'), current).split(sep).join('/')
        out.push(route)
      }
    }
  }
  walk(join(RAIZ, dir))
  return out
}

describe('la tabla de módulos por ruta', () => {
  it('cubre todas las páginas del admin y del dashboard', () => {
    // Una página nueva sin entrada quedaría sin protección de módulo.
    const sinEntrada = [...paginas('src/app/admin'), ...paginas('src/app/dashboard')].filter((route) => !requirementForPath(route))
    expect(sinEntrada).toEqual([])
  })

  it('cada entrada corresponde a una página que existe', () => {
    const existentes = new Set([...paginas('src/app/admin'), ...paginas('src/app/dashboard')])
    const huerfanas = Object.keys(ROUTE_MODULES).filter((route) => ![...existentes].some((page) => page === route || page.startsWith(`${route}/`)))
    expect(huerfanas).toEqual([])
  })

  it('las subpáginas heredan de su sección', () => {
    expect(requirementForPath('/dashboard/pos/caja/historial')?.module).toBe('pos')
    expect(requirementForPath('/admin/subscriptions/billing')?.module).toBeNull()
    expect(requirementForPath('/dashboard/products/credit-defaults')?.module).toBe('credits')
  })
})

describe('las inconsistencias de la auditoría', () => {
  it('Clientes y Posventa dependen de CRM, como sus API', () => {
    expect(requirementForPath('/dashboard/customers')?.module).toBe('crm')
    expect(requirementForPath('/dashboard/after-sales')?.module).toBe('crm')
  })

  it('Monitor de caja depende del POS e Informes de su módulo', () => {
    expect(requirementForPath('/admin/cash-monitor')?.module).toBe('pos')
    expect(requirementForPath('/admin/reports')?.module).toBe('reports')
  })

  it('Vencimientos solo en los rubros que venden con vencimiento', () => {
    expect(isRouteAvailable('/dashboard/vencimientos', ['inventory'], 'food')).toBe(true)
    expect(isRouteAvailable('/dashboard/vencimientos', ['inventory'], 'electronics')).toBe(false)
    // Sin rubro conocido todavía, se muestra.
    expect(isRouteAvailable('/dashboard/vencimientos', ['inventory'], null)).toBe(true)
  })

  it('con una lista alcanza cualquiera de los módulos', () => {
    expect(isRouteAvailable('/dashboard/products', ['services'])).toBe(true)
    expect(isRouteAvailable('/dashboard/products', ['pos'])).toBe(false)
  })
})

describe('los menús leen la tabla', () => {
  it('ningún item del menú declara su módulo a mano', () => {
    for (const archivo of ['src/config/admin-navigation.ts', 'src/config/dashboard-navigation.ts']) {
      const fuente = readFileSync(join(RAIZ, archivo), 'utf8')
      expect(fuente, archivo).not.toMatch(/\{ key: '[^']+',[^\n]*module: /)
      expect(fuente, archivo).not.toMatch(/^\s+module: '[a-z_]+',$/m)
    }
  })

  it('el módulo de cada item es el de la tabla', () => {
    const items = [
      ...adminNavCategories.flatMap((category) => category.items),
      ...dashboardNavGroups.flatMap((group) => group.items),
    ].filter((item) => item.href)
    for (const item of items) {
      expect(item.module ?? null, item.href).toEqual(requirementForPath(item.href!)?.module ?? null)
    }
  })
})

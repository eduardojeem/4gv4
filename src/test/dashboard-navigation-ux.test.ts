import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  dashboardNavGroups,
  filterDashboardNavGroups,
  getDashboardNavItemByPath,
  getMobileDashboardItems,
} from '@/config/dashboard-navigation'

const findItem = (key: string) =>
  dashboardNavGroups.flatMap((group) => group.items).find((item) => item.key === key)
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('dashboard navigation information architecture', () => {
  it('organizes daily work by user intent', () => {
    expect(dashboardNavGroups.map((group) => group.label)).toEqual([
      'Principal',
      'Ventas',
      'Inventario',
      'Taller',
      'Análisis y gestión',
    ])

    expect(dashboardNavGroups[0].items.map((item) => item.key)).toEqual([
      'overview',
      'pos',
      'cash-register',
    ])
    expect(dashboardNavGroups[1].items.map((item) => item.key)).toEqual([
      'orders',
      'customers',
      'credits',
      'after-sales',
      'promotions',
    ])
  })

  it('uses distinct semantic icons for concepts that were previously repeated', () => {
    expect(findItem('overview')?.icon).not.toBe(findItem('pos-analytics')?.icon)
    expect(findItem('cash-register')?.icon).not.toBe(findItem('credits')?.icon)
    expect(findItem('products')?.icon).not.toBe(findItem('repair-inventory')?.icon)
  })

  it('resolves the most specific active section and human breadcrumb', () => {
    expect(getDashboardNavItemByPath('/dashboard')).toMatchObject({
      key: 'overview',
      label: 'Resumen',
    })
    expect(getDashboardNavItemByPath('/dashboard/pos/caja/historial')).toMatchObject({
      key: 'cash-register',
      label: 'Caja',
    })
    expect(getDashboardNavItemByPath('/dashboard/repairs/inventory')).toMatchObject({
      key: 'repair-inventory',
      label: 'Inventario del taller',
    })
  })

  it('filters by role, permission and enabled module from one source', () => {
    const groups = filterDashboardNavGroups({
      role: 'vendedor',
      effectiveModules: ['pos', 'orders', 'inventory', 'credits', 'promotions', 'repairs'],
      hasPermission: () => true,
    })
    const keys = groups.flatMap((group) => group.items.map((item) => item.key))

    expect(keys).toContain('pos')
    expect(keys).toContain('repairs')
    expect(keys).not.toContain('pos-analytics')
    expect(keys).not.toContain('suppliers')
    expect(keys).not.toContain('administration')
  })

  it('keeps mobile priorities stable when optional modules disappear', () => {
    const groups = filterDashboardNavGroups({
      role: 'admin',
      effectiveModules: ['pos', 'inventory', 'repairs'],
      hasPermission: () => true,
    })

    expect(getMobileDashboardItems(groups, 5).map((item) => item.key)).toEqual([
      'overview',
      'pos',
      'products',
      'repairs',
      'customers',
    ])
  })

  it('drives sidebar, header and mobile navigation from the shared source', () => {
    const sidebar = read('src/components/dashboard/sidebar.tsx')
    const header = read('src/components/dashboard/header.tsx')
    const mobile = read('src/components/dashboard/mobile-nav.tsx')

    expect(sidebar).toContain("from '@/config/dashboard-navigation'")
    expect(sidebar).not.toContain('const NAV_GROUPS')
    expect(header).toContain('getDashboardNavItemByPath(pathname)')
    expect(header).not.toContain('const sectionMap')
    expect(mobile).toContain('getMobileDashboardItems')
    expect(mobile).not.toContain('const MOBILE_NAV_ITEMS')
  })

  it('uses a compact, collapsible and accessible sidebar like administration', () => {
    const sidebar = read('src/components/dashboard/sidebar.tsx')

    expect(sidebar).toContain("const DASHBOARD_NAV_STORAGE_KEY = 'dashboard-nav-expanded-groups'")
    expect(sidebar).toContain('aria-expanded={isExpanded}')
    expect(sidebar).toContain('<TooltipContent side="right"')
    expect(sidebar).toContain("collapsed ? 'w-20")
    expect(sidebar).not.toContain('sm:w-80')
  })
})

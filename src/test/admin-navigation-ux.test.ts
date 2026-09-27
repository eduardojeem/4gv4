import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Banknote, FileChartColumn, Landmark, MessageSquareText, ShieldCheck, Store } from 'lucide-react'

import { adminNavCategories, getCategoryByItemKey, getNavItemByKey, getNavItemByPath } from '@/config/admin-navigation'

const layoutSource = readFileSync(resolve(process.cwd(), 'src/components/admin/layout/AdminLayout.tsx'), 'utf8')

describe('admin navigation information architecture', () => {
  it('groups sections by user intent', () => {
    expect(adminNavCategories.map((category) => category.id)).toEqual(['analytics', 'operations', 'team', 'digital', 'system', 'help'])
    expect(getCategoryByItemKey('reports')?.id).toBe('analytics')
    expect(getCategoryByItemKey('finances')?.id).toBe('operations')
    expect(getCategoryByItemKey('users')?.id).toBe('team')
    expect(getCategoryByItemKey('website')?.id).toBe('digital')
    expect(getCategoryByItemKey('settings')?.id).toBe('system')
  })

  it('uses icons that distinguish each administrative intent', () => {
    expect(getNavItemByKey('cash-monitor')?.icon).toBe(Banknote)
    expect(getNavItemByKey('finances')?.icon).toBe(Landmark)
    expect(getNavItemByKey('reports')?.icon).toBe(FileChartColumn)
    expect(getNavItemByKey('reviews')?.icon).toBe(MessageSquareText)
    expect(getNavItemByKey('security')?.icon).toBe(ShieldCheck)
    expect(getNavItemByKey('business-profile')).toMatchObject({
      label: 'Datos del negocio',
      icon: Store,
    })
  })
})

describe('active admin navigation', () => {
  it('resolves the active item from pathname and keeps admin home exact', () => {
    expect(getNavItemByPath('/admin')).toMatchObject({ key: 'overview' })
    expect(getNavItemByPath('/admin/finances')).toMatchObject({
      key: 'finances',
    })
    expect(getNavItemByPath('/admin/finances/payroll')).toMatchObject({
      key: 'finances',
    })
    expect(getNavItemByPath('/admin/visitas?period=30d')).toMatchObject({
      key: 'website-visits',
    })
    expect(getNavItemByPath('/admin/onboarding')).toMatchObject({
      key: 'business-profile',
    })
    expect(getNavItemByPath('/admin-unrelated')).toBeUndefined()
  })

  it('uses pathname context, accessible tooltips and semantic colors', () => {
    expect(layoutSource).toContain('getNavItemByPath(pathname)')
    expect(layoutSource).not.toContain("searchParams.get('tab') ?? 'overview'")
    expect(layoutSource).toContain('<TooltipProvider')
    expect(layoutSource).toContain('<TooltipContent side="right"')
    expect(layoutSource).toContain('bg-primary/10')
    expect(layoutSource).not.toContain('from-blue-600 to-indigo-600')
  })

  it('opens the current category and remembers manual category choices', () => {
    expect(layoutSource).toContain('currentCategory.id')
    expect(layoutSource).toContain("const ADMIN_NAV_STORAGE_KEY = 'admin-nav-expanded-categories'")
    expect(layoutSource).toContain('window.localStorage.getItem(ADMIN_NAV_STORAGE_KEY)')
    expect(layoutSource).toContain('window.localStorage.setItem(ADMIN_NAV_STORAGE_KEY')
  })
})

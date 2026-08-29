import { describe, expect, it } from 'vitest'
import {
  filterDashboardSearchResultsByModules,
  getAvailableDashboardSearchTypes,
  isNavigationModuleAvailable,
} from './dashboard-navigation'

describe('dashboard module navigation', () => {
  it('keeps general entries and filters module-specific entries', () => {
    const effective = ['inventory', 'pos']
    expect(isNavigationModuleAvailable(undefined, effective)).toBe(true)
    expect(isNavigationModuleAvailable('pos', effective)).toBe(true)
    expect(isNavigationModuleAvailable('repairs', effective)).toBe(false)
  })
})

describe('dashboard module search', () => {
  it('removes repair filters and results when repairs is disabled', () => {
    expect(getAvailableDashboardSearchTypes(['inventory', 'pos'])).not.toContain('reparaciones')
    expect(getAvailableDashboardSearchTypes(['inventory', 'repairs'])).toContain('reparaciones')

    const results = [
      { title: 'Cliente', href: '/dashboard/customers/1' },
      { title: 'Reparación', href: '/dashboard/repairs?id=1' },
      { title: 'Técnico', href: '/dashboard/technician' },
    ]

    expect(filterDashboardSearchResultsByModules(results, ['inventory'])).toEqual([
      { title: 'Cliente', href: '/dashboard/customers/1' },
    ])
  })
})

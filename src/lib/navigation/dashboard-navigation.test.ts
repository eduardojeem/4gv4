import { describe, expect, it } from 'vitest'
import { isNavigationModuleAvailable } from './dashboard-navigation'

describe('dashboard module navigation', () => {
  it('keeps general entries and filters module-specific entries', () => {
    const effective = ['inventory', 'pos']
    expect(isNavigationModuleAvailable(undefined, effective)).toBe(true)
    expect(isNavigationModuleAvailable('pos', effective)).toBe(true)
    expect(isNavigationModuleAvailable('repairs', effective)).toBe(false)
  })
})

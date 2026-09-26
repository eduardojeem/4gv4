import { describe, expect, it } from 'vitest'
import { getModuleAvailability, resolveEffectiveModules, validateEnabledModules } from './effective-modules'

describe('effective organization modules', () => {
  it('preserves all entitled modules for legacy organizations', () => {
    expect(resolveEffectiveModules({
      entitledModules: ['inventory', 'pos', 'repairs'],
      trialModules: [],
      enabledModules: null,
    })).toEqual(['inventory', 'pos', 'repairs'])
  })

  it('intersects organization selection with plan and active trials', () => {
    expect(resolveEffectiveModules({
      entitledModules: ['inventory', 'pos'],
      trialModules: ['repairs'],
      enabledModules: ['inventory', 'repairs', 'security'],
    })).toEqual(['inventory', 'repairs'])
  })

  it('treats an empty selection as all optional modules disabled', () => {
    expect(resolveEffectiveModules({
      entitledModules: ['inventory', 'pos'],
      trialModules: [],
      enabledModules: [],
    })).toEqual([])
  })

  it('distinguishes organization choice from plan entitlement', () => {
    const input = {
      entitledModules: ['inventory', 'pos'],
      trialModules: [] as string[],
      enabledModules: ['inventory'] as string[],
    }
    expect(getModuleAvailability('inventory', input)).toBe('available')
    expect(getModuleAvailability('pos', input)).toBe('disabled_by_org')
    expect(getModuleAvailability('repairs', input)).toBe('not_in_plan')
  })

  it('removes duplicates and unknown module codes', () => {
    expect(resolveEffectiveModules({
      entitledModules: ['inventory', 'inventory', 'unknown'],
      trialModules: [],
      enabledModules: null,
    })).toEqual(['inventory'])
  })

  it('reports organization selections that are not commercially entitled', () => {
    expect(validateEnabledModules(
      ['inventory', 'repairs'],
      ['inventory', 'pos'],
      [],
    )).toEqual({ valid: false, unavailableModules: ['repairs'] })

    expect(validateEnabledModules(
      ['inventory', 'repairs'],
      ['inventory'],
      ['repairs'],
    )).toEqual({ valid: true, unavailableModules: [] })
  })
})

import { describe, expect, it } from 'vitest'
import {
  BusinessProfileInputSchema,
  getSuggestedModules,
  normalizeBusinessProfile,
} from './business-profile'
import { buildOrganizationBusinessProfile } from '@/lib/saas/effective-modules'

describe('organization business profile', () => {
  it('accepts a clothing retail profile with supported modules', () => {
    const parsed = BusinessProfileInputSchema.parse({
      businessVertical: 'clothing',
      operatingModel: 'retail',
      enabledModules: ['inventory', 'pos', 'crm', 'orders', 'ecommerce'],
    })

    expect(parsed.businessVertical).toBe('clothing')
    expect(parsed.enabledModules).toContain('ecommerce')
  })

  it('rejects unsupported verticals and modules', () => {
    expect(() => BusinessProfileInputSchema.parse({
      businessVertical: 'unknown',
      operatingModel: 'retail',
      enabledModules: ['inventory', 'secret_module'],
    })).toThrow()
  })

  it('normalizes legacy repair organizations without losing repair access', () => {
    expect(normalizeBusinessProfile({ legacyBusinessType: 'repair' })).toEqual({
      businessVertical: 'electronics',
      operatingModel: 'repair',
      enabledModules: null,
    })
  })

  it('uses conservative defaults for unknown legacy values', () => {
    expect(normalizeBusinessProfile({ legacyBusinessType: 'unrecognized' })).toEqual({
      businessVertical: 'general',
      operatingModel: 'retail',
      enabledModules: null,
    })
  })

  it.each([
    ['clothing', 'retail', false],
    ['cosmetics', 'retail', false],
    ['electronics', 'repair', true],
    ['general', 'service', false],
    ['general', 'mixed', true],
  ] as const)('suggests coherent modules for %s/%s', (vertical, model, hasRepairs) => {
    const modules = getSuggestedModules(vertical, model)
    expect(modules.includes('repairs')).toBe(hasRepairs)
    expect(new Set(modules).size).toBe(modules.length)
  })

  it('builds the effective profile from persisted values and plan access', () => {
    expect(buildOrganizationBusinessProfile({
      persisted: {
        businessVertical: 'clothing',
        operatingModel: 'retail',
        enabledModules: ['inventory', 'pos'],
      },
      entitledModules: ['inventory', 'pos', 'repairs'],
      trialModules: [],
    })).toEqual({
      businessVertical: 'clothing',
      operatingModel: 'retail',
      enabledModules: ['inventory', 'pos'],
      effectiveModules: ['inventory', 'pos'],
    })
  })
})

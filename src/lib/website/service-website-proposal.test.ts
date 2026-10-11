import { describe, expect, it } from 'vitest'
import * as proposal from './service-website-proposal'
import { resolveStorefrontCapabilities } from './storefront-capabilities'
import { CompanyInfoSchema } from '@/lib/validation/website-settings'

describe('service website proposals', () => {
  it('rejects unreadable light accents for buttons with white text', () => {
    expect(proposal.ServiceWebsiteOptionsSchema.safeParse({ variant: 'studio', specialties: [], accentColor: '#FFFFFF', title: 'Studio', subtitle: '' }).success).toBe(false)
  })
  it('retains the service variant when the standard company editor validates settings', () => {
    expect(CompanyInfoSchema.parse({ serviceWebsiteVariant: 'studio', serviceSpecialties: ['nails'] })).toMatchObject({ serviceWebsiteVariant: 'studio', serviceSpecialties: ['nails'] })
  })
  it.each(['barber', 'salon', 'studio', 'professional'])('prepares %s without modifying services or payment settings', variant => {
    const fn = (proposal as Record<string, unknown>).buildServiceWebsiteProposal
    expect(fn).toBeTypeOf('function')
    const current = { company_info: { name: 'Real Studio', phone: '123', logoUrl: '/logo.webp' }, services: [{ id: 'real', title: 'Manicura', price: 70000 }], checkout: { marker: 'keep' } }
    const before = JSON.stringify(current)
    const result = (fn as (input: unknown) => { values: Record<string, unknown> })({ variant, specialties: ['nails'], accentColor: '#826078', title: 'Mi estudio', subtitle: '', current, capabilities: resolveStorefrontCapabilities({ businessVertical: 'beauty_services', operatingModel: 'service', effectiveModules: ['services'] }) })
    expect(result.values).not.toHaveProperty('services')
    expect(result.values).not.toHaveProperty('checkout')
    expect(result.values.company_info).toMatchObject({ name: 'Real Studio', phone: '123', logoUrl: '/logo.webp', serviceWebsiteVariant: variant })
    expect(JSON.stringify(current)).toBe(before)
  })
})

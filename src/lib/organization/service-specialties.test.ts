import { describe, expect, it } from 'vitest'
import { BusinessProfileInputSchema, defaultOperatingModelFor } from './business-profile'

const base = { businessVertical: 'barbershop', operatingModel: 'service', enabledModules: null }
describe('service business classification', () => {
  it('accepts a broader services sector without replacing existing sectors', () => {
    for (const businessVertical of ['beauty_services', 'barbershop', 'cosmetics']) {
      expect(BusinessProfileInputSchema.safeParse({ ...base, businessVertical }).success).toBe(true)
    }
  })
  it('preserves multiple specialties and explicit empty selection', () => {
    expect(BusinessProfileInputSchema.parse({ ...base, serviceSpecialties: ['nails', 'lashes'] })).toMatchObject({ serviceSpecialties: ['nails', 'lashes'] })
    expect(BusinessProfileInputSchema.parse({ ...base, serviceSpecialties: [] })).toMatchObject({ serviceSpecialties: [] })
  })
  it.each([['nails', 'nails'], ['unknown'], [null]])('rejects invalid specialties %j', (...items) => {
    expect(BusinessProfileInputSchema.safeParse({ ...base, serviceSpecialties: items }).success).toBe(false)
  })
  it('rejects invalid attention and appointment modes', () => {
    expect(BusinessProfileInputSchema.safeParse({ ...base, attentionMode: 'invalid' }).success).toBe(false)
    expect(BusinessProfileInputSchema.safeParse({ ...base, appointmentMode: 'invalid' }).success).toBe(false)
  })
  it('keeps absent details absent for legacy PATCH requests', () => {
    const parsed = BusinessProfileInputSchema.parse(base)
    expect(parsed).not.toHaveProperty('serviceSpecialties')
    expect(parsed).not.toHaveProperty('attentionMode')
    expect(parsed).not.toHaveProperty('appointmentMode')
  })
  it('defaults new beauty service organizations to service operation', () => {
    expect(defaultOperatingModelFor('beauty_services' as Parameters<typeof defaultOperatingModelFor>[0])).toBe('service')
  })
})

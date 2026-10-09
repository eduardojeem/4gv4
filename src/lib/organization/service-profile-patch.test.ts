import { describe, expect, it } from 'vitest'
import { ServiceBusinessDetailsSchema, readServiceBusinessDetails } from './service-specialties'

describe('service profile partial update contract', () => {
  it('reads legacy defaults without converting an empty PATCH into resets', () => {
    expect(readServiceBusinessDetails({})).toEqual({ serviceSpecialties: [], attentionMode: 'local', appointmentMode: 'booking' })
    expect(ServiceBusinessDetailsSchema.parse({})).toEqual({})
  })
  it('preserves independently selected attention modes', () => {
    expect(ServiceBusinessDetailsSchema.parse({ attentionMode: 'home', appointmentMode: 'walk_in' })).toEqual({ attentionMode: 'home', appointmentMode: 'walk_in' })
  })
})

import { describe, expect, it } from 'vitest'
import * as details from './service-specialties'

describe('partial service profile persistence', () => {
  it('emits only explicitly supplied columns', () => {
    const fn = (details as Record<string, unknown>).serviceBusinessDetailsPatch
    expect(fn).toBeTypeOf('function')
    expect((fn as (input: unknown) => unknown)({})).toEqual({})
    expect((fn as (input: unknown) => unknown)({ serviceSpecialties: [] })).toEqual({ service_specialties: [] })
    expect((fn as (input: unknown) => unknown)({ attentionMode: 'home', appointmentMode: 'both' })).toEqual({ attention_mode: 'home', appointment_mode: 'both' })
  })
})

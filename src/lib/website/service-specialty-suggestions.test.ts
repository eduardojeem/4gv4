import { describe, expect, it } from 'vitest'
import * as suggestions from './service-specialty-suggestions'

describe('service specialty suggestions', () => {
  it('suggests only selected specialties without inventing prices or durations', () => {
    const fn = (suggestions as Record<string, unknown>).getServiceSpecialtySuggestions
    expect(fn).toBeTypeOf('function')
    const result = (fn as (input: string[]) => Record<string, unknown>[])(['nails', 'lashes'])
    expect(result.map(item => item.category)).toEqual(['Uñas', 'Uñas', 'Pestañas', 'Pestañas'])
    expect(result.every(item => !('price' in item) && !('duration' in item))).toBe(true)
    expect((fn as (input: string[]) => unknown[])([])).toEqual([])
  })
})

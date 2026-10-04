import { describe, expect, it } from 'vitest'
import { catalogHealth } from './health'

describe('catalogHealth', () => {
  it('no llama saludable a datos que no pudo comprobar', () => {
    expect(catalogHealth([null, 0])).toBe('unknown')
  })

  it('distingue errores, pendientes y estado sano', () => {
    expect(catalogHealth([1], { error: true })).toBe('error')
    expect(catalogHealth([1], { pending: 2 })).toBe('warning')
    expect(catalogHealth([1, 0], { pending: 0 })).toBe('healthy')
  })
})

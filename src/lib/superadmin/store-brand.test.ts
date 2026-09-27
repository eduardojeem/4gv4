import { describe, expect, it } from 'vitest'
import { describeStoreBrand, storeBrandScope } from './store-brand'

describe('color de marca de una tienda', () => {
  it('un color con nombre usa el esquema de la página pública', () => {
    expect(storeBrandScope('amber', null)).toEqual({ 'data-color-scheme': 'amber' })
  })

  it('un color propio se pasa como --brand-primary', () => {
    expect(storeBrandScope('custom', '#212536')).toEqual({ 'data-custom-brand': '', style: { '--brand-primary': '#212536' } })
  })

  /** El valor termina dentro de un `style`: solo hexadecimales. */
  it('un color propio que no es hexadecimal no se usa', () => {
    expect(storeBrandScope('custom', 'red; background: url(x)')).toEqual({ 'data-color-scheme': 'blue' })
    expect(storeBrandScope('custom', '')).toEqual({ 'data-color-scheme': 'blue' })
  })

  it('sin color, o con uno desconocido, es azul como la tienda', () => {
    expect(storeBrandScope(undefined, undefined)).toEqual({ 'data-color-scheme': 'blue' })
    expect(storeBrandScope('neon', null)).toEqual({ 'data-color-scheme': 'blue' })
  })

  it('lo dice en palabras', () => {
    expect(describeStoreBrand('custom', '#090b11')).toBe('Propio (#090B11)')
    expect(describeStoreBrand('amber', null)).toBe('Ámbar')
    expect(describeStoreBrand(null, null)).toBe('Azul (por defecto)')
  })
})

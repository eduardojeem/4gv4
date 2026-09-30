import { describe, expect, it } from 'vitest'
import { formatPlanLimit, normalizePlanLimits, parsePlanLimit } from './plan-limits'

describe('límites del plan', () => {
  it('entiende los formatos que ya estaban cargados', () => {
    expect(parsePlanLimit('80/mes')).toBe(80)
    expect(parsePlanLimit('5 000')).toBe(5000)
    expect(parsePlanLimit('1.000')).toBe(1000)
    expect(parsePlanLimit(500)).toBe(500)
    expect(parsePlanLimit('Ilimitados')).toBeNull()
    expect(parsePlanLimit('')).toBeNull()
    expect(parsePlanLimit('muchos')).toBeUndefined()
    expect(parsePlanLimit(-3)).toBeUndefined()
  })

  it('genera el texto de venta desde el número', () => {
    expect(formatPlanLimit('products', 10000)).toBe('10.000')
    expect(formatPlanLimit('repairs', 300)).toBe('300/mes')
    expect(formatPlanLimit('repairs', null)).toBe('Ilimitadas')
    expect(formatPlanLimit('users', null)).toBe('Ilimitados')
  })

  it('devuelve lo que se aplica y lo que se muestra, siempre coherentes', () => {
    expect(normalizePlanLimits({ products: '500', repairs: '300/mes', users: 'Ilimitado' })).toEqual({
      technical: { products: 500, repairs: 300, users: null },
      display: { products: '500', repairs: '300/mes', users: 'Ilimitados' },
    })
  })

  it('rechaza valores que no se pueden aplicar', () => {
    expect(normalizePlanLimits({ products: 'muchos' })).toEqual({ error: 'Productos: escribí un número o "Ilimitado".' })
    expect(normalizePlanLimits({ repairPhotos: 'Ilimitado' })).toEqual({ error: 'Fotos por reparación: indicá un número (0 = no incluye).' })
    expect(normalizePlanLimits({ repairPhotos: 50 })).toEqual({ error: 'Fotos por reparación: el máximo es 20.' })
  })
})

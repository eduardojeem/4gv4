import { describe, expect, it } from 'vitest'
import { computePlanChangeImpact, moduleLabel } from './plan-change-impact'

const gratis = [
  { label: 'Ecommerce & Marketplace', value: true },
  { label: 'Pedidos', value: true },
  { label: 'Entregas', value: true },
]

describe('impacto de guardar un plan', () => {
  it('detecta los módulos que las tiendas pierden', () => {
    const impact = computePlanChangeImpact(
      'free',
      { features: gratis, limits: {} },
      { features: [{ label: 'Ecommerce & Marketplace', value: true }, { label: 'Pedidos', value: false }, { label: 'Entregas', value: false }], limits: {} },
    )
    expect(impact.removedModules.sort()).toEqual(['delivery', 'orders'])
    expect(impact.addedModules).toEqual([])
    expect(moduleLabel('orders')).toBe('Pedidos')
  })

  it('detecta límites que bajan, incluido pasar de ilimitado a un tope', () => {
    const impact = computePlanChangeImpact(
      'pro',
      { features: [], limits: { products: '10.000', repairs: 'Ilimitadas', users: '15' } },
      { features: [], limits: { products: '5000', repairs: '500', users: '20' } },
    )
    expect(impact.loweredLimits).toEqual([
      { key: 'products', label: 'Productos', before: 10000, after: 5000 },
      { key: 'repairs', label: 'Reparaciones por mes', before: null, after: 500 },
    ])
  })

  it('subir límites o agregar módulos no es una pérdida', () => {
    const impact = computePlanChangeImpact(
      'basic',
      { features: [{ label: 'Analytics avanzado', value: false }], limits: { products: '500' } },
      { features: [{ label: 'Analytics avanzado', value: true }], limits: { products: '1000' } },
    )
    expect(impact.removedModules).toEqual([])
    expect(impact.addedModules).toEqual(['analytics'])
    expect(impact.loweredLimits).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { resolveServicePricingSelection } from './service-pricing-selection'

describe('resolveServicePricingSelection', () => {
  it('carga un servicio sin repuestos como mano de obra automática', () => {
    expect(resolveServicePricingSelection({ price: 150000, includesParts: false, deviceCount: 1 })).toEqual({
      affectsCalculator: true,
      pricingMode: 'automatic',
      laborCost: 150000,
      finalCost: undefined,
      message: 'Se cargó como mano de obra y se actualizó el total.',
    })
  })

  it('carga un servicio con repuestos como total acordado', () => {
    expect(resolveServicePricingSelection({ price: 200000, includesParts: true, deviceCount: 1 })).toEqual({
      affectsCalculator: true,
      pricingMode: 'budget',
      laborCost: undefined,
      finalCost: 200000,
      message: 'Se cargó como total acordado. Si agregás un repuesto, el total no cambia.',
    })
  })

  it('no aplica un precio a la calculadora compartida cuando hay varios equipos', () => {
    expect(resolveServicePricingSelection({ price: 150000, includesParts: false, deviceCount: 2 })).toEqual({
      affectsCalculator: false,
      pricingMode: undefined,
      laborCost: undefined,
      finalCost: undefined,
      message: undefined,
    })
  })
})

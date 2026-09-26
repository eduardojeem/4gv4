import type { RepairPricingMode } from '@/lib/repairs/pricing'

export type ServicePricingSelection = {
  affectsCalculator: boolean
  pricingMode?: RepairPricingMode
  laborCost?: number
  finalCost?: number
  message?: string
}

export function resolveServicePricingSelection(input: {
  price: number
  includesParts: boolean
  deviceCount: number
}): ServicePricingSelection {
  if (input.deviceCount !== 1) {
    return {
      affectsCalculator: false,
      pricingMode: undefined,
      laborCost: undefined,
      finalCost: undefined,
      message: undefined,
    }
  }

  if (input.includesParts) {
    return {
      affectsCalculator: true,
      pricingMode: 'budget',
      laborCost: undefined,
      finalCost: input.price,
      message: 'Se cargó como total acordado. Si agregás un repuesto, el total no cambia.',
    }
  }

  return {
    affectsCalculator: true,
    pricingMode: 'automatic',
    laborCost: input.price,
    finalCost: undefined,
    message: 'Se cargó como mano de obra y se actualizó el total.',
  }
}

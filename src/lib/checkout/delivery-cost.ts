interface DeliveryCostInput {
  fulfillmentType: 'PICKUP' | 'DELIVERY'
  subtotal: number
  defaultCost: number
  selectedZoneCost?: number
  freeThreshold: number
}

export function getDeliveryCost({
  fulfillmentType,
  subtotal,
  defaultCost,
  selectedZoneCost,
  freeThreshold,
}: DeliveryCostInput): number {
  if (fulfillmentType === 'PICKUP') return 0
  if (freeThreshold > 0 && subtotal >= freeThreshold) return 0

  return Math.max(0, selectedZoneCost ?? defaultCost)
}

import { calculateRepairPricing, type RepairPricingInput } from './pricing'

export type RepairCollectionPricingInput = RepairPricingInput & {
  estimatedCost?: number | null
}

/**
 * Resolves the authoritative balance used while collecting a repair payment.
 *
 * Older repairs may contain an agreed amount only in estimated_cost while
 * pricing_mode remained automatic and no labor/parts breakdown was saved.
 * Creation and edition keep using calculateRepairPricing directly; this
 * compatibility rule is deliberately restricted to the collection boundary.
 */
export function resolveRepairCollectionPricing(input: RepairCollectionPricingInput) {
  const pricing = calculateRepairPricing(input)
  const persistedTotal = Number(input.finalCost ?? input.estimatedCost)
  const canUseLegacyPrice =
    pricing.mode === 'automatic' &&
    pricing.customerTotal === 0 &&
    pricing.laborCost === 0 &&
    pricing.partsPrice === 0 &&
    Number.isFinite(persistedTotal) &&
    persistedTotal > pricing.paidAmount

  if (!canUseLegacyPrice) {
    return { pricing, reconciledLegacyPrice: false }
  }

  return {
    pricing: calculateRepairPricing({
      ...input,
      mode: 'budget',
      finalCost: persistedTotal,
    }),
    reconciledLegacyPrice: true,
  }
}

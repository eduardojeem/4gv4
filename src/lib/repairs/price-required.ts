/**
 * Una reparación «tiene precio» si alguien dijo cuánto se cobra: un precio
 * final (aunque sea 0, «sin cargo»), un presupuesto, mano de obra o repuestos
 * cobrados. Es la misma regla que usa la base para aceptar un adelanto sin
 * precio (REPAIR_PRICE_ALREADY_DEFINED).
 *
 * En el modo automático, sin nada de eso el total daba 0 y la reparación se
 * entregaba igual: el 13/10/2026 había 70 entregadas que Finanzas contaba en ₲ 0.
 */

type PricedRepair = {
  final_cost?: number | string | null
  estimated_cost?: number | string | null
  labor_cost?: number | string | null
  parts?: Array<{
    unit_price?: number | string | null
    unit_cost?: number | string | null
    quantity?: number | string | null
  }> | null
}

const positive = (value: unknown) => {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) && amount > 0
}

export function repairHasDefinedPrice(repair: PricedRepair): boolean {
  if (repair.final_cost !== null && repair.final_cost !== undefined) return true
  if (positive(repair.estimated_cost) || positive(repair.labor_cost)) return true
  return (repair.parts ?? []).some((part) =>
    positive(Number(part.unit_price ?? part.unit_cost ?? 0) * Math.max(0, Number(part.quantity ?? 0))),
  )
}

export const REPAIR_PRICE_REQUIRED_MESSAGE =
  'Definí cuánto cobraste antes de entregar. Si fue sin cargo (garantía o cortesía), marcalo como «Sin cargo».'

/** La misma regla con la forma de la pantalla (repair-mapping): precio de cada repuesto en `cost`. */
export function uiRepairHasDefinedPrice(repair: {
  finalCost?: number | null
  estimatedCost?: number | null
  laborCost?: number | null
  parts?: Array<{ cost?: number | null; quantity?: number | null }> | null
}): boolean {
  return repairHasDefinedPrice({
    final_cost: repair.finalCost,
    estimated_cost: repair.estimatedCost,
    labor_cost: repair.laborCost,
    parts: (repair.parts ?? []).map((part) => ({ unit_price: part.cost, quantity: part.quantity })),
  })
}

/** Lo que se manda para fijar el precio al entregar: presupuesto con el total cobrado. */
export function deliveryPricePatch(amount: number, noCharge: boolean) {
  return {
    pricingMode: 'budget' as const,
    finalCost: noCharge ? 0 : Math.max(0, Math.round(amount)),
    ...(noCharge ? { priceOverrideReason: 'Sin cargo: garantía o cortesía' } : {}),
  }
}

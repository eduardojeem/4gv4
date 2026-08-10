import { calculateRepairPricing, validateRepairPricing, type RepairPricingMode } from './pricing'

type PersistedPart = {
  unit_price?: number | null
  unit_cost?: number | null
  quantity?: number | null
}

export class RepairPricingWriteError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 422,
  ) {
    super(message)
    this.name = 'RepairPricingWriteError'
  }
}

export function resolveRepairPricingWrite(input: {
  mode: RepairPricingMode
  currency: string
  laborCost: number
  finalCost: number | null
  discountAmount: number
  paidAmount: number
  parts: PersistedPart[]
  role: string
  overrideReason?: string | null
}) {
  if (!['automatic', 'budget', 'manual'].includes(input.mode)) {
    throw new RepairPricingWriteError('Modo de calculo invalido.', 'INVALID_PRICING_MODE', 400)
  }
  const isAdmin = input.role === 'owner' || input.role === 'admin' || input.role === 'super_admin'
  if (input.mode === 'manual' && !isAdmin) {
    throw new RepairPricingWriteError(
      'El precio manual solo puede ser definido por un administrador.',
      'MANUAL_PRICING_FORBIDDEN',
      403,
    )
  }

  const pricingInput = {
    mode: input.mode,
    currency: input.currency,
    laborCost: input.laborCost,
    finalCost: input.finalCost,
    discountAmount: input.discountAmount,
    paidAmount: input.paidAmount,
    parts: input.parts.map((part) => ({
      cost: part.unit_price,
      internalCost: part.unit_cost,
      quantity: part.quantity,
    })),
  }
  const pricing = calculateRepairPricing(pricingInput)
  const violations = validateRepairPricing(pricingInput)

  if (violations.includes('DISCOUNT_EXCEEDS_SUBTOTAL')) {
    throw new RepairPricingWriteError('El descuento no puede superar el subtotal.', 'DISCOUNT_EXCEEDS_SUBTOTAL')
  }
  if (violations.includes('FINAL_REQUIRED')) {
    throw new RepairPricingWriteError('Ingresa el total acordado con el cliente.', 'FINAL_REQUIRED')
  }
  if (violations.includes('FINAL_BELOW_PARTS_PRICE')) {
    throw new RepairPricingWriteError('El presupuesto no cubre el precio de los repuestos.', 'FINAL_BELOW_PARTS_PRICE')
  }
  if (violations.includes('FINAL_BELOW_PAID_AMOUNT')) {
    throw new RepairPricingWriteError('El total no puede ser menor que el monto ya pagado.', 'FINAL_BELOW_PAID_AMOUNT')
  }

  const reason = input.overrideReason?.trim() || null
  if (pricing.discountAmount > 0 && (!reason || reason.length < 5)) {
    throw new RepairPricingWriteError(
      'Especifica el motivo del descuento.',
      'DISCOUNT_REASON_REQUIRED',
    )
  }
  if (pricing.customerTotal < pricing.partsInternalCost && !isAdmin) {
    throw new RepairPricingWriteError(
      'El total queda por debajo del costo interno y requiere autorizacion administrativa.',
      'BELOW_INTERNAL_COST_FORBIDDEN',
      403,
    )
  }
  if (pricing.customerTotal < pricing.partsInternalCost && (!reason || reason.length < 5)) {
    throw new RepairPricingWriteError(
      'Especifica el motivo para vender por debajo del costo interno.',
      'BELOW_INTERNAL_COST_REASON_REQUIRED',
    )
  }
  if (input.mode === 'manual' && pricing.customerTotal < pricing.partsPrice && (!reason || reason.length < 5)) {
    throw new RepairPricingWriteError(
      'Especifica el motivo del precio manual por debajo de los repuestos.',
      'PRICE_OVERRIDE_REASON_REQUIRED',
    )
  }

  const needsReason = pricing.discountAmount > 0 ||
    pricing.customerTotal < pricing.partsInternalCost ||
    (input.mode === 'manual' && pricing.customerTotal < pricing.partsPrice)

  return {
    laborCost: pricing.laborCost,
    finalCost: pricing.customerTotal,
    estimatedCost: pricing.customerTotal,
    discountAmount: pricing.discountAmount,
    pricingMode: pricing.mode,
    overrideReason: needsReason ? reason : null,
    margin: pricing.margin,
    balance: pricing.balance,
  }
}

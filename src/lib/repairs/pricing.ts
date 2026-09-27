import { getCurrencyFractionDigits } from '@/lib/currency'
import type { RepairLineType } from './line-types'
import { normalizeRepairLineType } from './line-types'

export type RepairPricingMode = 'automatic' | 'budget' | 'manual'

type RepairPricingPart = {
  cost?: number | null
  internalCost?: number | null
  quantity?: number | null
  lineType?: RepairLineType | null
}

function nonNegative(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

function roundMoney(value: number, currency = 'PYG') {
  const factor = 10 ** getCurrencyFractionDigits(currency)
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export type RepairPricingInput = {
  mode?: RepairPricingMode
  currency?: string
  laborCost?: number | null
  finalCost?: number | null
  discountAmount?: number | null
  paidAmount?: number | null
  parts?: RepairPricingPart[] | null
}

export function calculateRepairPricing(input: RepairPricingInput) {
  const mode = input.mode ?? 'automatic'
  const currency = input.currency ?? 'PYG'
  const enteredLabor = nonNegative(input.laborCost)
  const enteredFinal = input.finalCost === null || input.finalCost === undefined
    ? null
    : nonNegative(input.finalCost)
  const discountAmount = roundMoney(nonNegative(input.discountAmount), currency)
  const paidAmount = roundMoney(nonNegative(input.paidAmount), currency)
  const lineTotals = (input.parts ?? []).reduce((totals, part) => {
    const lineType = normalizeRepairLineType(part.lineType)
    const quantity = nonNegative(part.quantity)
    const customerAmount = nonNegative(part.cost) * quantity
    const internalAmount = nonNegative(part.internalCost) * quantity

    if (lineType === 'service') {
      totals.servicesSubtotal += customerAmount
    } else if (lineType === 'included_material') {
      totals.includedMaterialsInternalCost += internalAmount
      totals.partsInternalCost += internalAmount
    } else {
      totals.chargedPartsSubtotal += customerAmount
      totals.partsInternalCost += internalAmount
    }

    return totals
  }, {
    servicesSubtotal: 0,
    chargedPartsSubtotal: 0,
    includedMaterialsInternalCost: 0,
    partsInternalCost: 0,
  })

  const servicesSubtotal = roundMoney(lineTotals.servicesSubtotal, currency)
  const chargedPartsSubtotal = roundMoney(lineTotals.chargedPartsSubtotal, currency)
  const includedMaterialsInternalCost = roundMoney(lineTotals.includedMaterialsInternalCost, currency)
  const roundedInternalCost = roundMoney(lineTotals.partsInternalCost, currency)
  const billableLinesSubtotal = roundMoney(servicesSubtotal + chargedPartsSubtotal, currency)
  const automaticSubtotal = roundMoney(enteredLabor + billableLinesSubtotal, currency)
  const automaticTotal = roundMoney(Math.max(0, automaticSubtotal - discountAmount), currency)

  let laborCost = roundMoney(enteredLabor, currency)
  let customerTotal = automaticTotal

  if (mode === 'budget') {
    customerTotal = roundMoney(enteredFinal ?? 0, currency)
    laborCost = roundMoney(Math.max(0, customerTotal + discountAmount - billableLinesSubtotal), currency)
  } else if (mode === 'manual') {
    customerTotal = roundMoney(enteredFinal ?? automaticTotal, currency)
  }

  const subtotal = roundMoney(laborCost + billableLinesSubtotal, currency)

  return {
    mode,
    laborCost,
    servicesSubtotal,
    chargedPartsSubtotal,
    includedMaterialsInternalCost,
    // Alias kept for callers that still render the separately charged parts total.
    partsPrice: chargedPartsSubtotal,
    partsInternalCost: roundedInternalCost,
    subtotal,
    discountAmount,
    estimatedTotal: automaticTotal,
    customerTotal,
    paidAmount,
    balance: roundMoney(Math.max(0, customerTotal - paidAmount), currency),
    margin: roundMoney(customerTotal - roundedInternalCost, currency),
  }
}

export type RepairPricingViolation =
  | 'DISCOUNT_EXCEEDS_SUBTOTAL'
  | 'FINAL_REQUIRED'
  | 'FINAL_BELOW_PARTS_PRICE'
  | 'FINAL_BELOW_PAID_AMOUNT'

export function validateRepairPricing(input: RepairPricingInput): RepairPricingViolation[] {
  const result = calculateRepairPricing(input)
  const violations: RepairPricingViolation[] = []

  if (result.discountAmount > result.subtotal) violations.push('DISCOUNT_EXCEEDS_SUBTOTAL')
  if ((result.mode === 'budget' || result.mode === 'manual') && input.finalCost == null) {
    violations.push('FINAL_REQUIRED')
  }
  if (result.mode === 'budget'
    && result.customerTotal + result.discountAmount
      < result.servicesSubtotal + result.chargedPartsSubtotal) {
    violations.push('FINAL_BELOW_PARTS_PRICE')
  }
  if (result.customerTotal < result.paidAmount) violations.push('FINAL_BELOW_PAID_AMOUNT')

  return violations
}

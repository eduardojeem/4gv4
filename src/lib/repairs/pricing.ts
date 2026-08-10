import { getCurrencyFractionDigits } from '@/lib/currency'

export type RepairPricingMode = 'automatic' | 'budget' | 'manual'

type RepairPricingPart = {
  cost?: number | null
  internalCost?: number | null
  quantity?: number | null
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
  const partsPrice = (input.parts ?? []).reduce((total, part) => {
    return total + nonNegative(part.cost) * nonNegative(part.quantity)
  }, 0)
  const partsInternalCost = (input.parts ?? []).reduce((total, part) => {
    return total + nonNegative(part.internalCost) * nonNegative(part.quantity)
  }, 0)

  const roundedPartsPrice = roundMoney(partsPrice, currency)
  const roundedInternalCost = roundMoney(partsInternalCost, currency)
  const automaticSubtotal = roundMoney(enteredLabor + roundedPartsPrice, currency)
  const automaticTotal = roundMoney(Math.max(0, automaticSubtotal - discountAmount), currency)

  let laborCost = roundMoney(enteredLabor, currency)
  let customerTotal = automaticTotal

  if (mode === 'budget') {
    customerTotal = roundMoney(enteredFinal ?? 0, currency)
    laborCost = roundMoney(Math.max(0, customerTotal + discountAmount - roundedPartsPrice), currency)
  } else if (mode === 'manual') {
    customerTotal = roundMoney(enteredFinal ?? automaticTotal, currency)
  }

  const subtotal = roundMoney(laborCost + roundedPartsPrice, currency)

  return {
    mode,
    laborCost,
    partsPrice: roundedPartsPrice,
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
  if (result.mode === 'budget' && result.customerTotal + result.discountAmount < result.partsPrice) {
    violations.push('FINAL_BELOW_PARTS_PRICE')
  }
  if (result.customerTotal < result.paidAmount) violations.push('FINAL_BELOW_PAID_AMOUNT')

  return violations
}

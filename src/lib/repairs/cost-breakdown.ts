import { getCurrencyFractionDigits } from '@/lib/currency'
import type { RepairLineType } from './line-types'
import { normalizeRepairLineType } from './line-types'

export type RepairTaxRate = 0 | 5 | 10

export type RepairCostPartInput = {
  key: string
  quantity: number
  unitPrice: number
  unitCost: number
  discountAmount: number
  taxRate: RepairTaxRate
  lineType?: RepairLineType | null
}

export type RepairCostInput = {
  currency: string
  laborAmount: number
  laborTaxRate: RepairTaxRate
  parts: RepairCostPartInput[]
  additionalCharges: number
  deductions: number
  discountAmount: number
  paidAmount: number
}

export type RepairCostPolicy = {
  maxDiscountPercent: number
  isAdmin: boolean
  overrideReason?: string | null
}

export type RepairCostViolationCode =
  | 'NEGATIVE_AMOUNT'
  | 'PART_DISCOUNT_EXCEEDS_GROSS'
  | 'DISCOUNT_EXCEEDS_SUBTOTAL'
  | 'DISCOUNT_LIMIT_EXCEEDED'
  | 'PART_BELOW_COST'
  | 'OVERRIDE_REASON_REQUIRED'
  | 'FINAL_BELOW_PAID_AMOUNT'

export type RepairCostViolation = {
  code: RepairCostViolationCode
  partKey?: string
}

export type RepairTaxBreakdown = {
  rate: RepairTaxRate
  grossAmount: number
  taxableBase: number
  taxAmount: number
}

export type RepairCostSummary = {
  laborAmount: number
  partsSubtotal: number
  servicesSubtotal: number
  chargedPartsSubtotal: number
  includedMaterialsInternalCost: number
  partsInternalCost: number
  additionalCharges: number
  deductions: number
  discountAmount: number
  subtotalBeforeDiscount: number
  finalTotal: number
  paidAmount: number
  balance: number
  taxBreakdown: RepairTaxBreakdown[]
}

function finiteNonNegative(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

function moneyRound(value: number, currency: string) {
  const factor = 10 ** getCurrencyFractionDigits(currency)
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function hasReason(reason?: string | null) {
  return Boolean(reason?.trim() && reason.trim().length >= 5)
}

export function calculateRepairCost(input: RepairCostInput): RepairCostSummary {
  const currency = input.currency || 'PYG'
  const laborAmount = moneyRound(finiteNonNegative(input.laborAmount), currency)
  const additionalCharges = moneyRound(finiteNonNegative(input.additionalCharges), currency)
  const deductions = moneyRound(finiteNonNegative(input.deductions), currency)
  const discountAmount = moneyRound(finiteNonNegative(input.discountAmount), currency)
  const paidAmount = moneyRound(finiteNonNegative(input.paidAmount), currency)

  const components: Array<{ rate: RepairTaxRate; gross: number }> = [
    { rate: input.laborTaxRate, gross: laborAmount + additionalCharges },
  ]
  let partsSubtotal = 0
  let partsInternalCost = 0
  let servicesSubtotal = 0
  let chargedPartsSubtotal = 0
  let includedMaterialsInternalCost = 0

  for (const part of input.parts ?? []) {
    const quantity = finiteNonNegative(part.quantity)
    const gross = finiteNonNegative(part.unitPrice) * quantity
    const rowDiscount = Math.min(gross, finiteNonNegative(part.discountAmount))
    const subtotal = moneyRound(gross - rowDiscount, currency)
    const lineType = normalizeRepairLineType(part.lineType)
    partsSubtotal += subtotal
    if (lineType === 'service') {
      servicesSubtotal += subtotal
    } else {
      const internalCost = finiteNonNegative(part.unitCost) * quantity
      partsInternalCost += internalCost
      if (lineType === 'included_material') includedMaterialsInternalCost += internalCost
      else chargedPartsSubtotal += subtotal
    }
    components.push({ rate: part.taxRate, gross: subtotal })
  }

  partsSubtotal = moneyRound(partsSubtotal, currency)
  partsInternalCost = moneyRound(partsInternalCost, currency)
  servicesSubtotal = moneyRound(servicesSubtotal, currency)
  chargedPartsSubtotal = moneyRound(chargedPartsSubtotal, currency)
  includedMaterialsInternalCost = moneyRound(includedMaterialsInternalCost, currency)
  const subtotalBeforeDiscount = moneyRound(laborAmount + additionalCharges + partsSubtotal, currency)
  const finalTotal = moneyRound(
    Math.max(0, subtotalBeforeDiscount - discountAmount - deductions),
    currency,
  )
  const allocationFactor = subtotalBeforeDiscount > 0 ? finalTotal / subtotalBeforeDiscount : 0
  const grossByRate = new Map<RepairTaxRate, number>()

  for (const component of components) {
    if (component.gross <= 0) continue
    grossByRate.set(
      component.rate,
      (grossByRate.get(component.rate) ?? 0) + component.gross * allocationFactor,
    )
  }

  const taxBreakdown = [...grossByRate.entries()]
    .sort(([left], [right]) => left - right)
    .map(([rate, gross]) => {
      const grossAmount = moneyRound(gross, currency)
      const taxableBase = rate === 0
        ? grossAmount
        : moneyRound(grossAmount / (1 + rate / 100), currency)
      return {
        rate,
        grossAmount,
        taxableBase,
        taxAmount: moneyRound(grossAmount - taxableBase, currency),
      }
    })

  const allocated = taxBreakdown.reduce((sum, row) => sum + row.grossAmount, 0)
  const allocationDifference = moneyRound(finalTotal - allocated, currency)
  if (taxBreakdown.length > 0 && allocationDifference !== 0) {
    const target = taxBreakdown[taxBreakdown.length - 1]
    target.grossAmount = moneyRound(target.grossAmount + allocationDifference, currency)
    target.taxableBase = target.rate === 0
      ? target.grossAmount
      : moneyRound(target.grossAmount / (1 + target.rate / 100), currency)
    target.taxAmount = moneyRound(target.grossAmount - target.taxableBase, currency)
  }

  return {
    laborAmount,
    partsSubtotal,
    servicesSubtotal,
    chargedPartsSubtotal,
    includedMaterialsInternalCost,
    partsInternalCost,
    additionalCharges,
    deductions,
    discountAmount,
    subtotalBeforeDiscount,
    finalTotal,
    paidAmount,
    balance: moneyRound(Math.max(0, finalTotal - paidAmount), currency),
    taxBreakdown,
  }
}

export function validateRepairCost(
  input: RepairCostInput,
  policy: RepairCostPolicy,
): RepairCostViolation[] {
  const violations: RepairCostViolation[] = []
  const topLevelAmounts = [
    input.laborAmount,
    input.additionalCharges,
    input.deductions,
    input.discountAmount,
    input.paidAmount,
  ]
  if (topLevelAmounts.some((value) => !Number.isFinite(Number(value)) || Number(value) < 0)) {
    violations.push({ code: 'NEGATIVE_AMOUNT' })
  }

  let needsAdminOverride = false
  for (const part of input.parts ?? []) {
    const values = [part.quantity, part.unitPrice, part.unitCost, part.discountAmount]
    if (values.some((value) => !Number.isFinite(Number(value)) || Number(value) < 0)) {
      if (!violations.some((item) => item.code === 'NEGATIVE_AMOUNT')) {
        violations.push({ code: 'NEGATIVE_AMOUNT', partKey: part.key })
      }
      continue
    }
    const gross = part.quantity * part.unitPrice
    if (part.discountAmount > gross) {
      violations.push({ code: 'PART_DISCOUNT_EXCEEDS_GROSS', partKey: part.key })
    }
    const netUnitPrice = part.quantity > 0
      ? Math.max(0, gross - part.discountAmount) / part.quantity
      : 0
    if (normalizeRepairLineType(part.lineType) === 'charged_part'
      && part.quantity > 0 && netUnitPrice < part.unitCost) {
      needsAdminOverride = true
      if (!policy.isAdmin) violations.push({ code: 'PART_BELOW_COST', partKey: part.key })
    }
  }

  const summary = calculateRepairCost(input)
  if (summary.discountAmount + summary.deductions > summary.subtotalBeforeDiscount) {
    violations.push({ code: 'DISCOUNT_EXCEEDS_SUBTOTAL' })
  }
  const discountPercent = summary.subtotalBeforeDiscount > 0
    ? (summary.discountAmount / summary.subtotalBeforeDiscount) * 100
    : 0
  if (discountPercent > Math.max(0, policy.maxDiscountPercent)) {
    needsAdminOverride = true
    if (!policy.isAdmin) violations.push({ code: 'DISCOUNT_LIMIT_EXCEEDED' })
  }
  if (summary.finalTotal < summary.paidAmount) {
    violations.push({ code: 'FINAL_BELOW_PAID_AMOUNT' })
  }
  if (needsAdminOverride && policy.isAdmin && !hasReason(policy.overrideReason)) {
    violations.push({ code: 'OVERRIDE_REASON_REQUIRED' })
  }

  return violations
}

import { z } from 'zod'
import {
  buildCreditInstallmentPlan, buildCreditInstallmentPlanFromAmounts, fixedInstallmentAmounts,
  installmentAmountsError, MAX_CREDIT_INSTALLMENTS, MAX_CREDIT_INTEREST_RATE, roundToCurrencyUnit,
  type CreditFrequency, type CreditInstallmentPlan,
} from './installments'

/** Missing mode is a legacy percentage plan. Fixed amounts are never inferred from rate. */
export interface CreditPlanDefinition {
  count: number
  rate: number
  mode?: 'percent' | 'amount'
  installmentAmount?: number
}

export const CreditPlanDefinitionSchema = z.object({
  count: z.number().int().min(1, 'Mínimo 1 cuota').max(MAX_CREDIT_INSTALLMENTS, 'Máximo ' + MAX_CREDIT_INSTALLMENTS + ' cuotas'),
  rate: z.number().min(0, 'El recargo no puede ser negativo').max(MAX_CREDIT_INTEREST_RATE, 'El recargo no puede superar ' + MAX_CREDIT_INTEREST_RATE + '%'),
  mode: z.enum(['percent', 'amount']).optional(),
  installmentAmount: z.number().positive('El monto debe ser mayor a cero').multipleOf(0.01, 'Usá como máximo dos decimales').optional(),
}).superRefine((value, context) => {
  if (value.mode === 'amount' && value.installmentAmount === undefined) context.addIssue({ code: 'custom', path: ['installmentAmount'], message: 'Ingresá el monto fijo de cada cuota.' })
  if (value.mode !== 'amount' && value.installmentAmount !== undefined) context.addIssue({ code: 'custom', path: ['installmentAmount'], message: 'Elegí monto fijo para usar un valor por cuota.' })
})

export function resolveConfiguredCreditPlan(principal: number, definition: CreditPlanDefinition, frequency: CreditFrequency = 'monthly'):
  { plan: CreditInstallmentPlan; error: null } | { plan: null; error: string } {
  const parsed = CreditPlanDefinitionSchema.safeParse(definition)
  if (!parsed.success) return { plan: null, error: parsed.error.issues[0]?.message ?? 'El plan no es válido.' }
  if (!Number.isFinite(principal) || principal <= 0) return { plan: null, error: 'Ingresá un importe a financiar mayor a cero.' }
  if (definition.mode === 'amount') {
    const amount = definition.installmentAmount!
    if (roundToCurrencyUnit(amount) !== amount) return { plan: null, error: 'El monto fijo debe respetar la unidad mínima de la moneda; en guaraníes, usá enteros.' }
    const amounts = fixedInstallmentAmounts(definition.count, amount)
    const error = installmentAmountsError(principal, amounts)
    if (error) return { plan: null, error }
    return { plan: buildCreditInstallmentPlanFromAmounts({ principalAmount: principal, amounts, frequency }), error: null }
  }
  return { plan: buildCreditInstallmentPlan({ principalAmount: principal, interestRate: definition.rate, installmentCount: definition.count, frequency }), error: null }
}

export function fixedProductPlanErrors(input: {
  sale_price?: number | null; offer_price?: number | null; has_offer?: boolean | null
  installments_enabled?: boolean | null; installments_plans?: CreditPlanDefinition[] | null
}): { index: number; message: string }[] {
  if (!input.installments_enabled || !Array.isArray(input.installments_plans)) return []
  const sale = Number(input.sale_price)
  const offer = Number(input.offer_price)
  const principal = input.has_offer && offer > 0 && offer < sale ? offer : sale
  return input.installments_plans.flatMap((plan, index) => {
    if (!plan || plan.mode !== 'amount') return []
    const resolved = resolveConfiguredCreditPlan(principal, plan)
    return resolved.error ? [{ index, message: resolved.error }] : []
  })
}

/** Accept the thousands grouping used in Paraguay, without discarding invalid characters. */
export function parseFixedInstallmentInput(raw: string): number {
  const value = raw.trim()
  if (!value) return Number.NaN
  const grouped = /^[-+]?\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(value)
  return Number((grouped ? value.replace(/\./g, '') : value).replace(',', '.'))
}

export const CreditPlanFormSchema = z.object({
  ...CreditPlanDefinitionSchema.shape,
  count: z.coerce.number().pipe(CreditPlanDefinitionSchema.shape.count),
  rate: z.coerce.number().pipe(CreditPlanDefinitionSchema.shape.rate),
  installmentAmount: z.union([z.string(), z.number()]).transform(value => typeof value === 'string' ? parseFixedInstallmentInput(value) : value).pipe(CreditPlanDefinitionSchema.shape.installmentAmount.unwrap()).optional(),
}).pipe(CreditPlanDefinitionSchema).transform(value => value as CreditPlanDefinition)

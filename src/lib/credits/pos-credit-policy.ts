import { CreditPlanDefinitionSchema, type CreditPlanDefinition } from './plan-definition'
import {
  MAX_CREDIT_INSTALLMENTS,
  MAX_CREDIT_INTEREST_RATE,
  type CreditFrequency,
  type CreditScheduleMode,
} from './installments'

/**
 * Reglas del negocio para vender a crédito desde el POS (web y app).
 *
 * Se guardan dentro de los predeterminados de crédito de la organización
 * (`website_settings.product_credit_defaults.posPolicy`) y las aplica el
 * servidor al procesar la venta: el formulario solo las muestra.
 *
 * Los valores por defecto reproducen el comportamiento anterior (todo
 * permitido), así nada cambia hasta que el negocio las configure.
 */
export type CreditPosPolicy = {
  /** Si es false, solo se venden los planes del producto o los predeterminados. */
  allowCustomTerms: boolean
  /** Permite cuotas por valor fijo o cargadas a mano (además del recargo %). */
  allowInstallmentAmounts: boolean
  /** Recargo total máximo, en %. */
  maxInterestRate: number
  /** Cantidad máxima de cuotas. */
  maxInstallments: number
  /** Frecuencias permitidas. */
  allowedFrequencies: CreditFrequency[]
  /** Entrega mínima, en % del total de la venta. */
  minDownPaymentPercent: number
}

export const DEFAULT_CREDIT_POS_POLICY: CreditPosPolicy = {
  allowCustomTerms: true,
  allowInstallmentAmounts: true,
  maxInterestRate: MAX_CREDIT_INTEREST_RATE,
  maxInstallments: MAX_CREDIT_INSTALLMENTS,
  allowedFrequencies: ['weekly', 'biweekly', 'monthly'],
  minDownPaymentPercent: 0,
}

const FREQUENCIES: CreditFrequency[] = ['weekly', 'biweekly', 'monthly']

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}

/** Completa y acota lo guardado: un valor roto nunca abre más que el tope. */
export function normalizeCreditPosPolicy(value: unknown): CreditPosPolicy {
  const row = value && typeof value === 'object' ? value as Partial<Record<keyof CreditPosPolicy, unknown>> : {}
  const frequencies = Array.isArray(row.allowedFrequencies)
    ? FREQUENCIES.filter(frequency => (row.allowedFrequencies as unknown[]).includes(frequency))
    : DEFAULT_CREDIT_POS_POLICY.allowedFrequencies
  return {
    allowCustomTerms: typeof row.allowCustomTerms === 'boolean' ? row.allowCustomTerms : DEFAULT_CREDIT_POS_POLICY.allowCustomTerms,
    allowInstallmentAmounts: typeof row.allowInstallmentAmounts === 'boolean'
      ? row.allowInstallmentAmounts
      : DEFAULT_CREDIT_POS_POLICY.allowInstallmentAmounts,
    maxInterestRate: clampNumber(row.maxInterestRate, 0, MAX_CREDIT_INTEREST_RATE, DEFAULT_CREDIT_POS_POLICY.maxInterestRate),
    maxInstallments: Math.floor(clampNumber(row.maxInstallments, 1, MAX_CREDIT_INSTALLMENTS, DEFAULT_CREDIT_POS_POLICY.maxInstallments)),
    allowedFrequencies: frequencies.length > 0 ? frequencies : DEFAULT_CREDIT_POS_POLICY.allowedFrequencies,
    minDownPaymentPercent: clampNumber(row.minDownPaymentPercent, 0, 90, DEFAULT_CREDIT_POS_POLICY.minDownPaymentPercent),
  }
}

/** Dueños y administradores pueden salirse de la política (queda registrado). */
export function canOverrideCreditPosPolicy(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'admin'
}

export type CreditPlanOption = CreditPlanDefinition & { frequency: CreditFrequency }

export type CreditTermsToCheck = {
  installmentCount: number
  /** Recargo efectivo (en modo por monto, el que resulta de la suma de cuotas). */
  interestRate: number
  frequency: CreditFrequency
  mode: CreditScheduleMode
  /** Entrega en % del total de la venta. */
  downPaymentPercent: number
  installmentAmounts?: number[]
}

const FREQUENCY_LABEL: Record<CreditFrequency, string> = { weekly: 'semanal', biweekly: 'quincenal', monthly: 'mensual' }

/**
 * Primer motivo por el que las condiciones no cumplen la política, o null.
 * `plans` son los planes válidos para esta venta (de los productos del carrito
 * y los predeterminados de la organización).
 */
export function creditPosPolicyViolation(
  policy: CreditPosPolicy,
  terms: CreditTermsToCheck,
  plans: CreditPlanOption[],
): string | null {
  if (terms.downPaymentPercent + 1e-9 < policy.minDownPaymentPercent) {
    return `La entrega inicial tiene que ser de al menos ${policy.minDownPaymentPercent}% del total.`
  }
  if (terms.mode !== 'percent' && !policy.allowInstallmentAmounts) return 'Este negocio no permite cargar cuotas por monto.'
  if (!policy.allowCustomTerms) {
    const matches = plans.some(plan => {
      if (plan.count !== terms.installmentCount || plan.frequency !== terms.frequency) return false
      if (plan.mode === 'amount') return terms.mode !== 'percent' && terms.installmentAmounts?.length === plan.count && terms.installmentAmounts.every(amount => amount === plan.installmentAmount)
      return terms.mode === 'percent' && Math.abs(plan.rate - terms.interestRate) < 1e-9
    })
    return matches ? null : 'Elegí uno de los planes configurados para estos productos.'
  }
  if (terms.installmentCount > policy.maxInstallments) {
    return `El máximo es de ${policy.maxInstallments} cuotas.`
  }
  if (terms.interestRate > policy.maxInterestRate + 1e-9) {
    return `El recargo máximo permitido es ${policy.maxInterestRate}%.`
  }
  if (!policy.allowedFrequencies.includes(terms.frequency)) {
    return `No se permiten cuotas con frecuencia ${FREQUENCY_LABEL[terms.frequency]}.`
  }
  return null
}

/** Planes ofrecidos en la venta: los de los productos y los predeterminados. */
export function creditPlanOptions(input: {
  products: Array<{ installments_enabled?: boolean | null; installments_plans?: unknown }>
  defaults?: { plans?: CreditPlanDefinition[]; frequency?: CreditFrequency } | null
}): CreditPlanOption[] {
  const options = new Map<string, CreditPlanOption>()
  const add = (raw: unknown, frequency: CreditFrequency) => {
    const parsed = CreditPlanDefinitionSchema.safeParse(raw)
    if (!parsed.success) return
    const plan = parsed.data
    options.set(`${plan.count}:${plan.mode === 'amount' ? 'amount:' + plan.installmentAmount : plan.rate}:${frequency}`, { ...plan, frequency })
  }
  for (const product of input.products) {
    if (!product.installments_enabled || !Array.isArray(product.installments_plans)) continue
    for (const plan of product.installments_plans as Array<{ count?: unknown; rate?: unknown }>) {
      // El POS ofrece los planes del producto en cuotas mensuales.
      add(plan, 'monthly')
    }
  }
  const defaultFrequency = input.defaults?.frequency ?? 'monthly'
  for (const plan of input.defaults?.plans ?? []) add(plan, defaultFrequency)
  return [...options.values()].sort((a, b) => a.count - b.count || a.rate - b.rate)
}

import type { CreditPlanDefault, ProductCreditDefaults } from '@/types/website-settings'
import { buildCreditInstallmentPlan, type CreditFrequency } from '@/lib/credits/installments'

/**
 * Predeterminados de productos a credito: resuelve sobre que precio se
 * calculan las cuotas y arma la vista previa de cada plan.
 *
 * Antes la base estaba fija en el precio de venta. Ahora la elige la
 * configuracion, porque financiar sobre el costo y financiar sobre la venta
 * dan numeros muy distintos y cada negocio lo maneja distinto.
 */

/** Datos de precio que necesita el calculo. Coincide con las columnas del producto. */
export type CreditPricingInput = {
  purchase_price?: number | null
  sale_price?: number | null
  offer_price?: number | null
  has_offer?: boolean | null
}

export type ResolvedCreditBase = {
  /** Precio sobre el que se calcula, ya con margen u oferta aplicados. */
  baseAmount: number
  /** Entrega inicial en dinero. */
  downPayment: number
  /** Lo que efectivamente se financia (base menos entrega inicial). */
  financedAmount: number
  /** De donde salio el numero, para poder explicarlo en la UI. */
  source: 'sale' | 'offer' | 'cost'
}

function toAmount(value: unknown): number {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 ? amount : 0
}

function roundMoney(value: number) {
  return Number(value.toFixed(2))
}

/**
 * Devuelve el precio base segun la configuracion.
 *
 * - `sale`: precio de venta, o el de oferta si respectOffer esta activo y la
 *   oferta es real (menor que la venta).
 * - `cost`: precio de compra mas el margen configurado.
 */
export function resolveCreditBase(
  product: CreditPricingInput,
  defaults: ProductCreditDefaults,
): ResolvedCreditBase {
  const salePrice = toAmount(product.sale_price)
  const offerPrice = toAmount(product.offer_price)
  const purchasePrice = toAmount(product.purchase_price)

  let baseAmount: number
  let source: ResolvedCreditBase['source']

  if (defaults.calculationBase === 'cost') {
    const markup = Math.max(0, Number(defaults.costMarkupPercent) || 0)
    baseAmount = roundMoney(purchasePrice * (1 + markup / 100))
    source = 'cost'
  } else {
    const offerIsReal = Boolean(product.has_offer) && offerPrice > 0 && offerPrice < salePrice
    const useOffer = defaults.respectOffer && offerIsReal
    baseAmount = useOffer ? offerPrice : salePrice
    source = useOffer ? 'offer' : 'sale'
  }

  const downPercent = Math.min(90, Math.max(0, Number(defaults.downPaymentPercent) || 0))
  const downPayment = roundMoney(baseAmount * (downPercent / 100))
  const financedAmount = roundMoney(Math.max(0, baseAmount - downPayment))

  return { baseAmount, downPayment, financedAmount, source }
}

export type CreditPlanPreview = {
  count: number
  rate: number
  /** Valor de cada cuota (la ultima puede diferir por centavos de redondeo). */
  installmentAmount: number
  /** Total financiado con recargo, sin contar la entrega inicial. */
  financedTotal: number
  /** Lo que termina pagando el cliente: entrega inicial + total financiado. */
  totalWithDownPayment: number
}

/**
 * Calcula la vista previa de un plan sobre una base ya resuelta.
 * Reusa buildCreditInstallmentPlan para que la vista previa y el credito
 * realmente emitido no puedan divergir.
 */
export function buildCreditPlanPreview(
  plan: CreditPlanDefault,
  base: ResolvedCreditBase,
  frequency: CreditFrequency,
): CreditPlanPreview {
  const built = buildCreditInstallmentPlan({
    principalAmount: base.financedAmount,
    interestRate: plan.rate,
    installmentCount: plan.count,
    frequency,
  })

  return {
    count: built.installmentCount,
    rate: plan.rate,
    installmentAmount: built.installments[0]?.amount ?? 0,
    financedTotal: built.financedTotal,
    totalWithDownPayment: roundMoney(built.financedTotal + base.downPayment),
  }
}

/** Vista previa de todos los planes configurados, ordenados por cantidad. */
export function buildCreditPlanPreviews(
  product: CreditPricingInput,
  defaults: ProductCreditDefaults,
): { base: ResolvedCreditBase; previews: CreditPlanPreview[] } {
  const base = resolveCreditBase(product, defaults)
  const previews = [...defaults.plans]
    .sort((a, b) => a.count - b.count)
    .map((plan) => buildCreditPlanPreview(plan, base, defaults.frequency))

  return { base, previews }
}

/** Los planes tal como se guardan en el producto (`installments_plans`). */
export function toProductInstallmentPlans(defaults: ProductCreditDefaults): CreditPlanDefault[] {
  return [...defaults.plans]
    .sort((a, b) => a.count - b.count)
    .map((plan) => ({ count: plan.count, rate: plan.rate }))
}

export const CREDIT_BASE_LABELS: Record<ResolvedCreditBase['source'], string> = {
  sale: 'Precio de venta',
  offer: 'Precio de oferta',
  cost: 'Precio de costo',
}

import { buildCreditInstallmentPlan } from '@/lib/credits/installments'
import type { InstallmentPlanOption } from '@/types/product-unified'

export type ProductCreditSource = {
  installments_enabled?: boolean | null
  installments_plans?: InstallmentPlanOption[] | null
}

export type ProductCreditPlan = {
  count: number
  rate: number
  frequency: 'monthly'
  installmentAmount: number
  interestAmount: number
  financedTotal: number
}

function isValidPlan(plan: InstallmentPlanOption): boolean {
  return Number.isInteger(plan.count)
    && plan.count >= 1
    && plan.count <= 60
    && Number.isFinite(plan.rate)
    && plan.rate >= 0
    && plan.rate <= 100
}

export function getProductCreditPlans(
  product: ProductCreditSource,
  price: number,
): ProductCreditPlan[] {
  const effectivePrice = Number(price)
  if (!product.installments_enabled || !Number.isFinite(effectivePrice) || effectivePrice <= 0) {
    return []
  }

  const uniquePlans = new Map<string, InstallmentPlanOption>()
  for (const plan of product.installments_plans ?? []) {
    if (isValidPlan(plan)) uniquePlans.set(`${plan.count}:${plan.rate}`, plan)
  }

  return [...uniquePlans.values()]
    .sort((left, right) => left.count - right.count || left.rate - right.rate)
    .map(({ count, rate }) => {
      const calculated = buildCreditInstallmentPlan({
        principalAmount: effectivePrice,
        installmentCount: count,
        interestRate: rate,
        frequency: 'monthly',
      })

      return {
        count,
        rate,
        frequency: 'monthly' as const,
        installmentAmount: calculated.installments[0]?.amount ?? 0,
        interestAmount: calculated.interestAmount,
        financedTotal: calculated.financedTotal,
      }
    })
}

export function hasProductCredit(product: ProductCreditSource): boolean {
  return getProductCreditPlans(product, 1).length > 0
}

export function getFeaturedProductCreditPlan(
  product: ProductCreditSource,
  price: number,
): ProductCreditPlan | null {
  const plans = getProductCreditPlans(product, price)
  return plans.sort((left, right) => right.count - left.count || left.rate - right.rate)[0] ?? null
}

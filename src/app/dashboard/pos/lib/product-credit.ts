import { resolveConfiguredCreditPlan, CreditPlanDefinitionSchema } from '@/lib/credits/plan-definition'
import type { InstallmentPlanOption } from '@/types/product-unified'

export type ProductCreditSource = {
  installments_enabled?: boolean | null
  installments_plans?: InstallmentPlanOption[] | null
}
export type ProductCreditPlan = {
  count: number; rate: number; frequency: 'monthly'
  installmentAmount: number; interestAmount: number; financedTotal: number
  mode?: 'percent' | 'amount'; error?: string
}
export function getProductCreditPlans(product: ProductCreditSource, price: number): ProductCreditPlan[] {
  if (!product.installments_enabled || !Number.isFinite(price) || price <= 0) return []
  const definitions = new Map<string, InstallmentPlanOption>()
  for (const raw of product.installments_plans ?? []) {
    const parsed = CreditPlanDefinitionSchema.safeParse(raw)
    if (parsed.success) definitions.set(parsed.data.count + ':' + (parsed.data.mode === 'amount' ? 'amount:' + parsed.data.installmentAmount : parsed.data.rate), parsed.data)
  }
  return [...definitions.values()].sort((a, b) => a.count - b.count || a.rate - b.rate).flatMap(definition => {
    const result = resolveConfiguredCreditPlan(price, definition)
    if (result.error && definition.mode !== 'amount') return []
    const calculated = result.plan
    return [{
      count: definition.count, rate: calculated?.interestRate ?? definition.rate, frequency: 'monthly' as const,
      installmentAmount: calculated?.installments[0]?.amount ?? definition.installmentAmount ?? 0,
      interestAmount: calculated?.interestAmount ?? 0,
      financedTotal: calculated?.financedTotal ?? definition.count * (definition.installmentAmount ?? 0),
      ...(definition.mode === 'amount' ? { mode: 'amount' as const } : {}),
      ...(result.error ? { error: result.error } : {}),
    }]
  })
}
export function hasProductCredit(product: ProductCreditSource): boolean {
  return Boolean(product.installments_enabled && product.installments_plans?.some(plan => CreditPlanDefinitionSchema.safeParse(plan).success))
}
export function getFeaturedProductCreditPlan(product: ProductCreditSource, price: number): ProductCreditPlan | null {
  return getProductCreditPlans(product, price).filter(plan => !plan.error).sort((a, b) => b.count - a.count || a.rate - b.rate)[0] ?? null
}

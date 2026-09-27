import {
  getFeaturedProductCreditPlan,
  getProductCreditPlans,
  hasProductCredit,
  type ProductCreditSource,
} from './product-credit'

export type ProductCreditSort =
  | 'installment_low'
  | 'rate_low'
  | 'installments_high'
  | 'financed_total_low'

export type ProductCreditFilterOptions = {
  creditOnly: boolean
  minimumInstallments: number
  creditSort: ProductCreditSort | null
}

type CreditFilterProduct = ProductCreditSource & {
  sale_price: number
}

export function applyProductCreditFilter<T extends CreditFilterProduct>(
  products: readonly T[],
  options: ProductCreditFilterOptions,
): T[] {
  const minimumInstallments = Math.max(1, Math.floor(Number(options.minimumInstallments) || 1))
  const filtered = products.filter((product) => {
    if (options.creditOnly && !hasProductCredit(product)) return false
    if (minimumInstallments <= 1) return true

    return getProductCreditPlans(product, product.sale_price)
      .some(plan => plan.count >= minimumInstallments)
  })

  if (!options.creditSort) return [...filtered]

  return [...filtered].sort((left, right) => {
    const leftPlan = getFeaturedProductCreditPlan(left, left.sale_price)
    const rightPlan = getFeaturedProductCreditPlan(right, right.sale_price)
    if (!leftPlan) return rightPlan ? 1 : 0
    if (!rightPlan) return -1

    switch (options.creditSort) {
      case 'installment_low':
        return leftPlan.installmentAmount - rightPlan.installmentAmount
      case 'rate_low':
        return leftPlan.rate - rightPlan.rate
          || rightPlan.count - leftPlan.count
      case 'installments_high':
        return rightPlan.count - leftPlan.count
          || leftPlan.rate - rightPlan.rate
      case 'financed_total_low':
        return leftPlan.financedTotal - rightPlan.financedTotal
    }
  })
}

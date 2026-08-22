import type { InstallmentPlanOption } from '@/types/product-unified'
import type { PaymentSplit } from '../types'

import { getProductCreditPlans } from './product-credit'

export type CartCreditSource = {
  id: string
  name: string
  price: number
  quantity: number
  installmentsEnabled?: boolean
  installmentsPlans?: InstallmentPlanOption[]
}

export type CartProductCreditPlan = {
  productId: string
  productName: string
  count: number
  interestRate: number
  frequency: 'monthly'
  productSubtotal: number
  cartSubtotal: number
}

export type ProductCreditAllocation = {
  financedPrincipal: number
  dueNow: number
}

const roundMoney = (value: number) => Math.round(value * 100) / 100

export function getProductCreditAllocation(
  plan: Pick<CartProductCreditPlan, 'productSubtotal' | 'cartSubtotal'>,
  cartTotal: number,
): ProductCreditAllocation {
  const normalizedTotal = Math.max(0, roundMoney(Number(cartTotal) || 0))
  const ratio = plan.cartSubtotal > 0
    ? Math.min(1, Math.max(0, plan.productSubtotal / plan.cartSubtotal))
    : 0
  const financedPrincipal = roundMoney(normalizedTotal * ratio)

  return {
    financedPrincipal,
    dueNow: roundMoney(normalizedTotal - financedPrincipal),
  }
}

export function buildProductCreditPayments(
  plan: CartProductCreditPlan,
  cartTotal: number,
  createId: () => string,
): PaymentSplit[] {
  const allocation = getProductCreditAllocation(plan, cartTotal)
  return [
    ...(allocation.dueNow > 0 ? [{
      id: createId(),
      method: 'cash' as const,
      amount: allocation.dueNow,
    }] : []),
    ...(allocation.financedPrincipal > 0 ? [{
      id: createId(),
      method: 'credit' as const,
      amount: allocation.financedPrincipal,
    }] : []),
  ]
}

export function getCartProductCreditPlans(
  items: CartCreditSource[],
  catalogItems: CartCreditSource[] = [],
): CartProductCreditPlan[] {
  const catalogById = new Map(catalogItems.map(item => [item.id, item]))
  const cartSubtotal = items.reduce((total, item) => total + (item.price * item.quantity), 0)

  return items.flatMap(item => {
    const catalogItem = catalogById.get(item.id)
    const creditSource = catalogItem?.installmentsEnabled !== undefined ? catalogItem : item

    return getProductCreditPlans({
      installments_enabled: creditSource.installmentsEnabled,
      installments_plans: creditSource.installmentsPlans,
    }, item.price).map(plan => ({
    productId: item.id,
    productName: item.name,
    count: plan.count,
    interestRate: plan.rate,
    frequency: plan.frequency,
    productSubtotal: item.price * item.quantity,
    cartSubtotal,
    }))
  })
}

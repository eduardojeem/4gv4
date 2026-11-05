import type { InstallmentPlanOption } from '@/types/product-unified'
import type { PaymentSplit } from '../types'

import { roundToCurrencyUnit } from '@/lib/credits/installments'

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

/**
 * Redondeo a la unidad de la moneda (guarani entero en PYG). Con centavos fijos,
 * Gs. 100.000 repartidos 1/3 daban 33.333,33 a credito y 66.666,67 en efectivo:
 * el servidor redondea el credito a 33.333 y la caja registraba decimales.
 */
const roundMoney = (value: number) => roundToCurrencyUnit(value)
// El total de la venta se respeta tal cual lo calcula el servidor (dos
// decimales): redondearlo a la unidad haria que los pagos no sumen el total.
const roundCents = (value: number) => Math.round(value * 100) / 100

export function getProductCreditAllocation(
  plan: Pick<CartProductCreditPlan, 'productSubtotal' | 'cartSubtotal'>,
  cartTotal: number,
): ProductCreditAllocation {
  const normalizedTotal = Math.max(0, roundCents(Number(cartTotal) || 0))
  const ratio = plan.cartSubtotal > 0
    ? Math.min(1, Math.max(0, plan.productSubtotal / plan.cartSubtotal))
    : 0
  // Lo que se cobra ahora se redondea y el credito se queda con el resto, asi
  // efectivo + credito suman exactamente el total de la venta.
  const dueNow = Math.min(normalizedTotal, roundMoney(normalizedTotal * (1 - ratio)))
  const financedPrincipal = roundCents(normalizedTotal - dueNow)

  return {
    financedPrincipal,
    dueNow,
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

/**
 * Adelanto manual sobre el credito general del cliente (no un plan por
 * producto): el cajero escribe cuanto cobra ahora y el resto se financia.
 *
 * Separado de `buildProductCreditPayments` porque ahi el "dueNow" lo dicta un
 * plan predefinido por producto; aca lo elige la persona en el momento, asi
 * que el monto se acota entre 0 y el total en vez de derivarse de una
 * proporcion.
 */
export function buildManualDownPaymentSplit(
  cartTotal: number,
  downPayment: number,
  downPaymentMethod: 'cash' | 'card' | 'transfer',
  createId: () => string,
): PaymentSplit[] {
  const normalizedTotal = Math.max(0, roundCents(Number(cartTotal) || 0))
  const normalizedDownPayment = Math.min(
    normalizedTotal,
    Math.max(0, roundMoney(Number(downPayment) || 0)),
  )
  const financedAmount = roundCents(normalizedTotal - normalizedDownPayment)

  return [
    ...(normalizedDownPayment > 0 ? [{
      id: createId(),
      method: downPaymentMethod,
      amount: normalizedDownPayment,
    }] : []),
    ...(financedAmount > 0 ? [{
      id: createId(),
      method: 'credit' as const,
      amount: financedAmount,
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

/**
 * El adelanto más chico para que el resto, con su interés, entre en el crédito
 * disponible del cliente. Null si no hace falta adelanto o si no alcanza ni
 * cobrando casi todo (sin disponible).
 *
 * Se deja un guaraní de margen cuando hay interés: el interés se redondea y,
 * justo en el límite, el total financiado podía pasarse por uno y el servidor
 * rechazaba la venta.
 */
export function minimumCreditDownPayment(cartTotal: number, availableCredit: number, interestRatePercent: number): number | null {
  const total = Math.max(0, Number(cartTotal) || 0)
  const available = Math.max(0, Number(availableCredit) || 0)
  if (available <= 0 || total <= 0) return null
  const rate = Math.max(0, Number(interestRatePercent) || 0) / 100
  const maxPrincipal = Math.max(0, Math.floor(available / (1 + rate)) - (rate > 0 ? 1 : 0))
  if (maxPrincipal >= total) return null
  const minimum = Math.ceil(total - maxPrincipal)
  return minimum < total ? minimum : null
}

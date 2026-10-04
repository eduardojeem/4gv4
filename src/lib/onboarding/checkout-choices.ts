import type { CheckoutSettings } from '@/types/website-settings'

/**
 * Cómo cobra y entrega la tienda, en lo mínimo que hay que preguntar el
 * primer día. La configuración completa (instrucciones, zonas con precio,
 * billetera, pedido mínimo) sigue en Sitio Web → Cobro; acá solo se tocan
 * estos campos y el resto se conserva.
 */
export type CheckoutChoices = {
  cash: boolean
  card: boolean
  transfer: boolean
  wallet: boolean
  transferBank: string
  transferAccount: string
  transferHolder: string
  transferAlias: string
  delivery: boolean
  deliveryCost: number
  deliveryZones: string
  pickup: boolean
}

/** Lo que trae una tienda nueva: efectivo y retiro en el local. */
export const STARTER_CHECKOUT_CHOICES: CheckoutChoices = {
  cash: true,
  card: false,
  transfer: false,
  wallet: false,
  transferBank: '',
  transferAccount: '',
  transferHolder: '',
  transferAlias: '',
  delivery: false,
  deliveryCost: 0,
  deliveryZones: '',
  pickup: true,
}

type PartialCheckout = Partial<CheckoutSettings> & {
  payment?: Partial<Record<keyof CheckoutSettings['payment'], Partial<CheckoutSettings['payment']['cash']>>>
}

/** Las opciones del formulario a partir de lo que la tienda ya tiene guardado. */
export function choicesFromCheckout(checkout: PartialCheckout | null | undefined): CheckoutChoices {
  if (!checkout || typeof checkout !== 'object' || !checkout.payment) return { ...STARTER_CHECKOUT_CHOICES }
  const transfer: Partial<CheckoutSettings['payment']['transfer']> = checkout.payment.transfer ?? {}
  const option = transfer.transferOptions?.[0]
  return {
    cash: checkout.payment.cash?.enabled === true,
    card: checkout.payment.card?.enabled === true,
    transfer: transfer.enabled === true,
    wallet: checkout.payment.digital_wallet?.enabled === true,
    transferBank: option?.bankName ?? transfer.bankName ?? '',
    transferAccount: option?.accountNumber ?? transfer.bankCbu ?? '',
    transferHolder: option?.accountHolder ?? '',
    transferAlias: option?.alias ?? transfer.bankAlias ?? '',
    delivery: checkout.delivery?.enabled === true,
    deliveryCost: Number(checkout.delivery?.defaultCost ?? 0) || 0,
    deliveryZones: checkout.delivery?.zones ?? '',
    pickup: checkout.pickup?.enabled === true,
  }
}

/** Qué falta para que el cliente pueda comprar. null = está bien. */
export function checkoutChoicesError(choices: CheckoutChoices): string | null {
  if (!choices.cash && !choices.card && !choices.transfer && !choices.wallet) return 'Elegí al menos una forma de pago.'
  if (!choices.delivery && !choices.pickup) return 'Elegí si hacés envíos, retiro en el local o las dos cosas.'
  if (choices.transfer && !choices.transferAlias.trim() && !(choices.transferBank.trim() && choices.transferAccount.trim())) {
    return 'Para transferencias poné el banco y el número de cuenta, o un alias.'
  }
  if (choices.delivery && choices.deliveryCost < 0) return 'El costo del envío no puede ser negativo.'
  return null
}

/**
 * Aplica las opciones sobre el cobro guardado. Solo cambia lo que se pregunta:
 * instrucciones, otras cuentas, zonas con precio y el resto quedan como estaban.
 */
export function applyCheckoutChoices(base: CheckoutSettings, choices: CheckoutChoices): CheckoutSettings {
  const transfer = base.payment.transfer
  const options = transfer.transferOptions ?? []
  const hasBankData = Boolean(choices.transferAlias.trim() || choices.transferBank.trim() || choices.transferAccount.trim())
  const primary = {
    id: options[0]?.id ?? 'principal',
    bankName: choices.transferBank.trim(),
    accountNumber: choices.transferAccount.trim() || undefined,
    accountHolder: choices.transferHolder.trim() || undefined,
    alias: choices.transferAlias.trim() || undefined,
  }
  return {
    ...base,
    payment: {
      ...base.payment,
      cash: { ...base.payment.cash, enabled: choices.cash },
      card: { ...base.payment.card, enabled: choices.card },
      transfer: {
        ...transfer,
        enabled: choices.transfer,
        transferOptions: hasBankData ? [primary, ...options.slice(1)] : options,
      },
      digital_wallet: { ...base.payment.digital_wallet, enabled: choices.wallet },
    },
    delivery: {
      ...base.delivery,
      enabled: choices.delivery,
      defaultCost: Math.max(0, Math.round(Number(choices.deliveryCost) || 0)),
      zones: choices.deliveryZones.trim(),
    },
    pickup: { ...base.pickup, enabled: choices.pickup },
  }
}

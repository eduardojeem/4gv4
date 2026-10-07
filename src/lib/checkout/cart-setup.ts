import type { BankTransferOption, CheckoutSettings, CompanyInfo } from '@/types/website-settings'

/**
 * Qué le falta a una tienda para recibir pedidos por carrito. Lo usan el
 * editor (pasos y bloqueo al guardar), el servidor (las reglas que no dependen
 * de otros datos) y el asistente de la sección.
 */

export type CartSetupStep = 'payments' | 'delivery' | 'pickup' | 'order'
export type CartSetupLevel = 'error' | 'warn'

export interface CartSetupIssue {
  id: string
  step: CartSetupStep
  level: CartSetupLevel
  message: string
  /** Se arregla en otra sección del sitio (por ejemplo, la dirección en Empresa). */
  fixIn?: 'company'
}

export function isTransferAccountComplete(option: BankTransferOption): boolean {
  return option.bankName.trim().length >= 2 && Boolean(option.alias?.trim() || option.accountNumber?.trim())
}

/** Cuentas cargadas, también las guardadas con el formato viejo (un solo banco). */
export function transferAccounts(transfer: CheckoutSettings['payment']['transfer']): BankTransferOption[] {
  if (transfer.transferOptions !== undefined) return transfer.transferOptions
  if (!transfer.bankName && !transfer.bankAlias && !transfer.bankCbu) return []
  return [{ id: 'legacy-bank-option', bankName: transfer.bankName || 'Cuenta bancaria', alias: transfer.bankAlias || '', accountNumber: transfer.bankCbu || '', accountHolder: '' }]
}

/**
 * Reglas que dependen solo del cobro: sin esto el cliente no puede pagar o no
 * sabe cuánto. Las valida también el servidor.
 */
export function cartConfigErrors(checkout: CheckoutSettings): CartSetupIssue[] {
  const issues: CartSetupIssue[] = []
  const { payment, delivery } = checkout
  const anyPayment = payment.cash.enabled || payment.card.enabled || payment.transfer.enabled || payment.digital_wallet.enabled
  if (!anyPayment) issues.push({ id: 'no-payment', step: 'payments', level: 'error', message: 'Activá al menos una forma de pago.' })

  if (payment.transfer.enabled) {
    const accounts = transferAccounts(payment.transfer)
    if (accounts.length === 0) {
      issues.push({ id: 'transfer-no-account', step: 'payments', level: 'error', message: 'La transferencia necesita al menos una cuenta: banco y alias o número de cuenta.' })
    } else if (!accounts.every(isTransferAccountComplete)) {
      issues.push({ id: 'transfer-incomplete', step: 'payments', level: 'error', message: 'Cada cuenta bancaria necesita banco y alias o número de cuenta.' })
    }
  }

  if (payment.digital_wallet.enabled && !payment.digital_wallet.walletAlias?.trim() && !payment.digital_wallet.qrImageUrl?.trim()) {
    issues.push({ id: 'wallet-empty', step: 'payments', level: 'error', message: 'La billetera necesita tu alias o la imagen del QR para que el cliente pueda pagar.' })
  }

  if (delivery.enabled) {
    if ((delivery.zoneOptions ?? []).some((zone) => zone.name.trim().length < 2 || zone.cost < 0)) {
      issues.push({ id: 'zones-invalid', step: 'delivery', level: 'error', message: 'Cada zona de delivery necesita nombre y una tarifa válida.' })
    }
    if (!delivery.estimatedTime.trim()) {
      issues.push({ id: 'delivery-time', step: 'delivery', level: 'error', message: 'Indicá en cuánto tiempo entregás (por ejemplo «En el día»).' })
    }
  }

  if (checkout.pickup.enabled && !checkout.pickup.estimatedTime.trim()) {
    issues.push({ id: 'pickup-time', step: 'pickup', level: 'error', message: 'Indicá en cuánto tiempo está listo el pedido para retirar.' })
  }
  return issues
}

/**
 * Revisión completa del carrito, con lo que depende de la empresa y del plan.
 * Los errores bloquean el guardado; los avisos no.
 */
export function reviewCartSetup(
  checkout: CheckoutSettings,
  context: { company?: Partial<Pick<CompanyInfo, 'address' | 'hours'>> | null; deliveryModuleEnabled: boolean },
): CartSetupIssue[] {
  const issues = cartConfigErrors(checkout)
  const deliveryOffered = checkout.delivery.enabled && context.deliveryModuleEnabled
  if (!deliveryOffered && !checkout.pickup.enabled) {
    issues.push({ id: 'no-fulfillment', step: 'pickup', level: 'error', message: 'Activá el retiro en el local o el envío a domicilio.' })
  }

  if (checkout.pickup.enabled && !context.company?.address?.trim()) {
    issues.push({ id: 'pickup-no-address', step: 'pickup', level: 'warn', fixIn: 'company', message: 'Ofrecés retiro pero no cargaste la dirección del local: el cliente no sabe a dónde ir.' })
  }
  if (deliveryOffered && !(checkout.delivery.zoneOptions?.length) && !checkout.delivery.defaultCost) {
    issues.push({ id: 'delivery-no-cost', step: 'delivery', level: 'warn', message: 'El delivery no tiene costo ni zonas: el cliente verá «costo a coordinar».' })
  }
  const minimum = checkout.minOrderAmount || 0
  if (minimum > 0 && minimum < 1000) {
    issues.push({ id: 'min-typo', step: 'order', level: 'warn', message: `Un pedido mínimo de Gs. ${minimum} parece un error de tipeo.` })
  }
  if (deliveryOffered && checkout.delivery.freeThreshold > 0 && minimum >= checkout.delivery.freeThreshold) {
    issues.push({ id: 'free-below-min', step: 'order', level: 'warn', message: 'El envío gratis arranca por debajo del pedido mínimo: todos los envíos serían gratis.' })
  }
  if (!checkout.confirmationMessage?.trim()) {
    issues.push({ id: 'no-confirmation', step: 'order', level: 'warn', message: 'Escribí el mensaje que ve el cliente al confirmar: qué pasa después y cómo lo contactás.' })
  }
  return issues
}

/**
 * Textos de partida con los datos de la empresa, solo donde el dueño todavía
 * no escribió nada. No activa nada ni inventa cuentas.
 */
export function fillCartTextsFromCompany(
  checkout: CheckoutSettings,
  company: Partial<Pick<CompanyInfo, 'name' | 'address' | 'hours' | 'whatsapp' | 'phone'>> | null | undefined,
): CheckoutSettings {
  const address = company?.address?.trim()
  const hours = company?.hours?.weekdays?.trim()
  const contact = company?.whatsapp?.trim() || company?.phone?.trim()
  const pickupText = [
    address ? `Retirá en ${address}.` : 'Retirá en nuestro local.',
    hours ? `Horario: ${hours}.` : '',
    'Mostrá tu número de pedido al llegar.',
  ].filter(Boolean).join(' ')
  const keep = (current: string | undefined, fallback: string) => current?.trim() ? current : fallback
  return {
    ...checkout,
    pickup: { ...checkout.pickup, instructions: keep(checkout.pickup.instructions, pickupText) },
    delivery: {
      ...checkout.delivery,
      instructions: keep(checkout.delivery.instructions, contact ? `Te escribimos al ${contact} cuando el pedido sale.` : 'Te avisamos cuando el pedido sale.'),
    },
    confirmationMessage: keep(
      checkout.confirmationMessage,
      `¡Gracias por tu compra${company?.name ? ` en ${company.name}` : ''}! Recibimos tu pedido y te contactamos${contact ? ` al ${contact}` : ''} para confirmarlo.`,
    ),
  }
}

export const CART_SETUP_STEPS: Array<{ step: CartSetupStep; label: string; anchor: string }> = [
  { step: 'payments', label: 'Formas de pago', anchor: 'checkout-payments' },
  { step: 'delivery', label: 'Envío a domicilio', anchor: 'checkout-delivery' },
  { step: 'pickup', label: 'Retiro en el local', anchor: 'checkout-pickup' },
  { step: 'order', label: 'Pedido y confirmación', anchor: 'checkout-order' },
]

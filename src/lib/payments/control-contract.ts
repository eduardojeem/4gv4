import { z } from 'zod'

export const SUBSCRIPTION_CONTROL_IDS = ['bancard_card', 'stripe', 'autopay', 'promo'] as const
export const COMMERCE_CONTROL_IDS = ['cash', 'card', 'transfer', 'qr', 'digital_wallet', 'credit', 'store_credit'] as const
export type SubscriptionControlId = typeof SUBSCRIPTION_CONTROL_IDS[number]
export type CommerceControlId = typeof COMMERCE_CONTROL_IDS[number]
export type ControlScope = 'subscriptions' | 'commerce'
export type ControlFlags = Record<string, boolean>
export type PaymentControl = {
  id: string; title: string; description: string; channels: string[]
  enabled: boolean; configured: boolean; available: boolean; editable: boolean
  settingsHref?: string
  revision?: string | null
  implementation?: 'implemented' | 'pending'
  nextSteps?: string[]
  history?: { confirmed: boolean | null; detail: string }
}
export type PaymentControlSnapshot = { scope: ControlScope; revision: string | null; methods: PaymentControl[]; organizationId?: string; canEdit?: boolean; configurationNotice?: string }
export const controlUpdateSchema = z.object({
  id: z.string().min(1).max(40), enabled: z.boolean(), revision: z.string().max(120).nullable(),
}).strict()

export class PaymentControlError extends Error {
  constructor(message: string, readonly status = 503, readonly code = 'PAYMENT_CONTROLS_UNAVAILABLE') { super(message) }
}

export function controlIds(scope: ControlScope): readonly string[] {
  return scope === 'subscriptions' ? SUBSCRIPTION_CONTROL_IDS : COMMERCE_CONTROL_IDS
}

export function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

/** An absent policy keeps existing behavior; a malformed persisted policy must not silently enable charges. */
export function controlFlags(container: unknown, scope: ControlScope): ControlFlags {
  const raw = objectValue(container).payment_controls
  if (raw !== undefined && (!raw || typeof raw !== 'object' || Array.isArray(raw))) {
    throw new PaymentControlError('No se pudo validar la configuración de medios de pago.')
  }
  const values = objectValue(raw)
  return Object.fromEntries(controlIds(scope).map(id => {
    if (values[id] !== undefined && typeof values[id] !== 'boolean') throw new PaymentControlError('La configuración de medios de pago no es válida.')
    return [id, values[id] !== false]
  }))
}

export function requireControlEnabled(flags: ControlFlags, id: string) {
  if (flags[id] !== true) throw new PaymentControlError('Este medio de pago está deshabilitado. Elegí otro medio disponible.', 409, 'PAYMENT_METHOD_DISABLED')
}

const ALIASES: Record<string, CommerceControlId> = {
  cash: 'cash', efectivo: 'cash', card: 'card', tarjeta: 'card', transfer: 'transfer', transferencia: 'transfer',
  bank_transfer: 'transfer', qr: 'qr', digital_wallet: 'digital_wallet', wallet: 'digital_wallet',
  credit: 'credit', credito: 'credit', store_credit: 'store_credit', saldo_a_favor: 'store_credit',
}
export function commerceControlId(method: unknown): CommerceControlId {
  const key = typeof method === 'string' ? method.trim().toLowerCase() : ''
  const id = ALIASES[key]
  if (!id) throw new PaymentControlError('El medio de cobro no es válido.', 400, 'INVALID_PAYMENT_METHOD')
  return id
}
export type ControlledPayment = { method: unknown; channel?: unknown; amount?: number }
export function validateCommercePayments(flags: ControlFlags, payments: ControlledPayment[]) {
  for (const payment of payments) {
    if (payment.amount === 0) continue
    requireControlEnabled(flags, commerceControlId(payment.method))
    if (payment.channel === 'qr') requireControlEnabled(flags, 'qr')
  }
}

const commerceDescriptions: Record<CommerceControlId, [string, string, string[]]> = {
  cash: ['Efectivo', 'Registrar cobros en efectivo respetando la caja y permisos vigentes.', ['POS', 'Reparaciones', 'Pedidos', 'Cuotas']],
  card: ['Tarjeta', 'Registrar el comprobante de un cobro con terminal. No conecta una nueva pasarela.', ['POS', 'Reparaciones', 'Pedidos', 'Cuotas']],
  transfer: ['Transferencia bancaria', 'Registrar transferencias con su referencia y datos de conciliación.', ['POS', 'Reparaciones', 'Pedidos', 'Cuotas']],
  qr: ['QR', 'Cobros QR registrados como transferencia en POS. Requiere transferencia habilitada.', ['POS']],
  digital_wallet: ['Billetera digital', 'Opción de pago de pedidos web; no procesa automáticamente una billetera externa.', ['Tienda web', 'Pedidos']],
  credit: ['Venta a crédito', 'Permitir nuevas financiaciones. No impide cobrar cuotas de créditos ya existentes.', ['POS', 'Reparaciones']],
  store_credit: ['Saldo a favor', 'Permitir usar el saldo del cliente en nuevas compras, sin modificar su saldo guardado.', ['POS', 'Tienda web']],
}
export function commerceControlCatalog(flags: ControlFlags): PaymentControl[] {
  return COMMERCE_CONTROL_IDS.map(id => ({
    id, title: commerceDescriptions[id][0], description: commerceDescriptions[id][1], channels: commerceDescriptions[id][2],
    enabled: flags[id], configured: true, available: flags[id] && (id !== 'qr' || flags.transfer), editable: true,
    implementation: 'implemented', nextSteps: id === 'qr' && !flags.transfer ? ['Habilitar transferencia bancaria para registrar cobros QR.'] : [],
  }))
}
